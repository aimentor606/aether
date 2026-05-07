#!/usr/bin/env bash
# Shared functions for aether scripts.
# Usage: source "$(dirname "$0")/lib/common.sh"

# Resolve the monorepo root. common.sh lives at scripts/lib/common.sh, so go up 2 levels.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SELFHOSTED_DIR="$ROOT_DIR/scripts/supabase"

check_docker() {
  if ! docker info >/dev/null 2>&1; then
    echo "[ERROR] Docker daemon is not running"
    exit 1
  fi
}

wait_for_port() {
  local host="${1:-127.0.0.1}"
  local port="${2:-5434}"
  local timeout="${3:-120}"
  local label="${4:-$host:$port}"

  echo "[wait] Waiting for $label ..."
  python3 - "$host" "$port" "$timeout" <<'PY'
import socket, sys, time
host, port, timeout = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
deadline = time.time() + timeout
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=1):
            sys.exit(0)
    except OSError:
        time.sleep(1)
print(f"[wait] ERROR: Timed out waiting for {host}:{port}", file=sys.stderr)
sys.exit(1)
PY
}

ensure_supabase_running() {
  local tag="${1:-[start]}"
  echo "$tag Ensuring local Supabase is running..."
  check_docker
  # Create shared network if missing (needed for db/redis app-network access)
  docker network inspect app-network >/dev/null 2>&1 || docker network create app-network
  if ! docker compose -f "$SELFHOSTED_DIR/docker-compose.yml" --env-file "$SELFHOSTED_DIR/.env" \
       ps --status running 2>/dev/null | grep -q "supabase-kong"; then
    echo "$tag Starting self-hosted Supabase stack..."
    docker compose -f "$SELFHOSTED_DIR/docker-compose.yml" --env-file "$SELFHOSTED_DIR/.env" up -d
  fi
  wait_for_port 127.0.0.1 5434 120 "Supabase Postgres"
}

ensure_litellm_running() {
  local tag="${1:-[start]}"
  local ops_env="$ROOT_DIR/scripts/deploy/ops/.env"

  # Require ops/.env with LiteLLM config
  if [ ! -f "$ops_env" ]; then
    echo "$tag ERROR: scripts/deploy/ops/.env not found." >&2
    echo "  Create it from ops/.env.example and set LLM_PROXY=litellm." >&2
    exit 1
  fi

  source "$ops_env"

  if [ "${LLM_PROXY:-}" != "litellm" ]; then
    echo "$tag ERROR: LLM_PROXY is not set to 'litellm' in ops/.env." >&2
    echo "  Set LLM_PROXY=litellm and configure LITELLM_MASTER_KEY, provider keys." >&2
    exit 1
  fi

  # Validate required LiteLLM credentials
  local litellm_secrets="LITELLM_MASTER_KEY LITELLM_SALT_KEY LITELLM_DB_PASSWORD REDIS_PASSWORD"
  for var in $litellm_secrets; do
    if [ -z "${!var:-}" ] || [ "${!var}" = "CHANGE_ME" ] || [ "${!var}" = "sk-CHANGE_ME" ]; then
      echo "$tag ERROR: $var is missing or still a placeholder in ops/.env." >&2
      exit 1
    fi
  done

  # Validate at least one LLM provider key is set
  local has_provider_key=false
  for var in DEEPSEEK_API_KEY QWEN_API_KEY ZHIPU_API_KEY; do
    if [ -n "${!var:-}" ] && [ "${!var}" != "CHANGE_ME" ]; then
      has_provider_key=true
      break
    fi
  done
  if [ "$has_provider_key" = false ]; then
    echo "$tag ERROR: No LLM provider API keys set in ops/.env." >&2
    echo "  Set at least one of: DEEPSEEK_API_KEY, QWEN_API_KEY, ZHIPU_API_KEY" >&2
    exit 1
  fi

  # Create litellm database on supabase-db if it doesn't exist
  local db_exists
  db_exists=$(docker exec supabase-db psql -U postgres -lqt 2>/dev/null | grep -c "^ litellm " || echo "0")
  if [ "$db_exists" = "0" ]; then
    echo "$tag Creating litellm database on supabase-db..."
    docker exec supabase-db psql -U postgres -c "CREATE DATABASE litellm;" 2>/dev/null || true
  fi

  # Start LiteLLM via production compose (shares app-network with Supabase)
  if ! docker ps --format '{{.Names}}' | grep -q '^llm-proxy$'; then
    echo "$tag Starting LiteLLM proxy..."
    docker compose -f "$ROOT_DIR/scripts/deploy/core/litellm.yml" \
      --env-file "$ops_env" up -d
  fi

  wait_for_port 127.0.0.1 4000 60 "LiteLLM proxy"
  echo "$tag LiteLLM proxy: ready (http://127.0.0.1:4000)"
}

ensure_sandbox_running() {
  local tag="${1:-[start]}"
  local compose_base="$ROOT_DIR/core/docker/docker-compose.yml"
  local compose_dev="$ROOT_DIR/core/docker/docker-compose.dev.yml"
  local image_name="aether/computer:dev"

  # Check if sandbox image exists locally
  if ! docker image inspect "$image_name" >/dev/null 2>&1; then
    echo "$tag WARNING: Sandbox image '$image_name' not found." >&2
    echo "  Build it first: pnpm dev:core:build" >&2
    echo "  Skipping sandbox — will be created on first use via /init." >&2
    return 0
  fi

  # Start sandbox container (with dev overlay for hot reload)
  if ! docker ps --format '{{.Names}}' | grep -q '^aether-sandbox$'; then
    if docker ps -a --format '{{.Names}}' | grep -q '^aether-sandbox$'; then
      echo "$tag Starting existing sandbox container..."
      docker start aether-sandbox >/dev/null
    else
      echo "$tag Creating sandbox container..."
      docker compose -f "$compose_base" -f "$compose_dev" up -d 2>/dev/null || \
      docker compose -f "$compose_base" up -d
    fi
  fi

  # Wait for sandbox health endpoint
  echo "$tag Waiting for sandbox to become healthy..."
  local elapsed=0
  while [ "$elapsed" -lt 90 ]; do
    if curl -sf http://127.0.0.1:14000/aether/health >/dev/null 2>&1; then
      echo "$tag Sandbox: ready (http://127.0.0.1:14000)"
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  echo "$tag WARNING: Sandbox did not become healthy within 90s (may still be starting)" >&2
}

cleanup_trap() {
  local pid_var="$1"
  trap '
    exit_code=$?
    trap - EXIT INT TERM
    if [[ -n "${'"$pid_var"':-}" ]] && kill -0 "$('"$pid_var"')" 2>/dev/null; then
      kill "$('"$pid_var"')" 2>/dev/null || true
      wait "$('"$pid_var"')" 2>/dev/null || true
    fi
    exit "$exit_code"
  ' EXIT INT TERM
}
