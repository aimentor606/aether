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
