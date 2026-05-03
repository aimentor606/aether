#!/usr/bin/env bash
set -euo pipefail

# Full nuke & reset of local environment.
#
# Scopes:
#   dev     — dev stack only (Supabase, sandbox, dev containers, ports 8008/3000)
#   install — get-aether.sh install stack only (aether-hosted-sandbox, install compose)
#   all     — everything (default)
#
# Usage:
#   pnpm nuke                    # nuke everything
#   pnpm nuke --scope dev        # nuke dev stack only
#   pnpm nuke --start            # nuke everything, then start dev

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

SCOPE="all"
START_DEV=false

while [[ "${1:-}" != "" ]]; do
  case "$1" in
    --scope)
      SCOPE="${2:-all}"
      shift 2
      ;;
    --scope=*)
      SCOPE="${1#*=}"
      shift
      ;;
    --start)
      START_DEV=true
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NUKING LOCAL ENVIRONMENT (scope: $SCOPE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

DOCKER_AVAILABLE=true
if ! docker info >/dev/null 2>&1; then
  DOCKER_AVAILABLE=false
fi

# ── 1. Kill local dev processes ──
if [[ "$SCOPE" == "dev" || "$SCOPE" == "all" ]]; then
  echo "[1/5] Killing running processes..."
  lsof -ti:8008 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  lsof -ti:3000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  echo "  done (ports 8008, 3000 cleared)"
fi

# ── 2. Remove repo containers ──
echo "[2/5] Removing Docker containers..."
if ! $DOCKER_AVAILABLE; then
  echo "  WARNING: Docker daemon unavailable — containers not removed"
else
  PATTERNS=()
  if [[ "$SCOPE" == "dev" || "$SCOPE" == "all" ]]; then
    # Dev containers: sandbox (all 3 naming conventions), dev compose services
    PATTERNS+=("^aether-sandbox$" "^aether-hosted-sandbox$" "^justavps-workload$")
    PATTERNS+=("^aether-")           # dev compose services (aether-api, aether-frontend, etc.)
    PATTERNS+=("^supabase_")         # self-hosted Supabase stack
  fi
  if [[ "$SCOPE" == "install" || "$SCOPE" == "all" ]]; then
    PATTERNS+=("^aether-hosted-")    # get-aether.sh managed containers
  fi

  REGEX=$(IFS='|'; echo "${PATTERNS[*]}")
  CONTAINERS=$(docker ps -a --format "{{.Names}}" | grep -E "$REGEX" || true)
  if [[ -n "$CONTAINERS" ]]; then
    printf '%s\n' "$CONTAINERS" | xargs docker rm -f >/dev/null 2>&1 || true
    echo "  removed: $(printf '%s ' "$CONTAINERS")"
  else
    echo "  (no matching containers)"
  fi
fi

# ── 3. Remove repo volumes ──
echo "[3/5] Removing Docker volumes..."
if ! $DOCKER_AVAILABLE; then
  echo "  WARNING: Docker daemon unavailable — volumes not removed"
else
  VOL_PATTERNS=()
  if [[ "$SCOPE" == "dev" || "$SCOPE" == "all" ]]; then
    VOL_PATTERNS+=("sandbox" "^aether_supabase-db-data$" "^supabase_(db|storage)_")
  fi
  if [[ "$SCOPE" == "install" || "$SCOPE" == "all" ]]; then
    VOL_PATTERNS+=("supabase-db-data")  # get-aether.sh named volume
  fi

  VOL_REGEX=$(IFS='|'; echo "${VOL_PATTERNS[*]}")
  VOLS=$(docker volume ls --format "{{.Name}}" | grep -E "$VOL_REGEX" || true)
  if [[ -n "$VOLS" ]]; then
    printf '%s\n' "$VOLS" | xargs docker volume rm -f >/dev/null 2>&1 || true
    echo "  removed: $(printf '%s ' "$VOLS")"
  else
    echo "  (no matching volumes)"
  fi
fi

# ── 4. Verify sandbox image exists ──
if [[ "$SCOPE" == "dev" || "$SCOPE" == "all" ]]; then
  echo "[4/5] Checking sandbox image..."
  cd "$ROOT_DIR"
  SANDBOX_IMAGE="${SANDBOX_IMAGE:-aether/computer:latest}"

  if docker image inspect "$SANDBOX_IMAGE" >/dev/null 2>&1; then
    echo "  $SANDBOX_IMAGE exists locally"
  else
    echo "  WARNING: $SANDBOX_IMAGE not found locally!"
    echo "  Build it first:  docker build -f core/docker/Dockerfile --build-arg SANDBOX_VERSION=dev -t $SANDBOX_IMAGE ."
  fi
fi

# ── 5. Stop self-hosted Supabase stack ──
if [[ "$SCOPE" == "dev" || "$SCOPE" == "all" ]]; then
  echo "[5/5] Stopping self-hosted Supabase stack..."
  if ! $DOCKER_AVAILABLE; then
    echo "  WARNING: Docker daemon unavailable — Supabase stack not stopped"
  elif [ -f "$SELFHOSTED_DIR/docker-compose.yml" ]; then
    docker compose -f "$SELFHOSTED_DIR/docker-compose.yml" --env-file "$SELFHOSTED_DIR/.env" down -v 2>/dev/null || true
    echo "  done (stack stopped, volumes removed)"
  else
    echo "  (no self-hosted stack found)"
  fi
fi

cd "$ROOT_DIR"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  NUKED (scope: $SCOPE)"
echo "  Next: pnpm dev (starts API + frontend, sandbox auto-creates on first request)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Optional: restart dev ──
if $START_DEV; then
  echo "Starting dev (API + frontend)..."
  cd "$ROOT_DIR"
  exec pnpm run dev
fi
