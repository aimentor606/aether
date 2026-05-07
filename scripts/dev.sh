#!/usr/bin/env bash
set -euo pipefail
# Start local dev environment (Supabase + LiteLLM + Sandbox + API + frontend).
#
# Usage:
#   ./scripts/dev.sh              # dev mode (hot reload + all infra)
#   ./scripts/dev.sh --prod       # production build mode
#   ./scripts/dev.sh --no-sandbox # skip sandbox container
#   ./scripts/dev.sh --monitoring # also start Prometheus + Grafana
#   ./scripts/dev.sh --openmeter  # also start OpenMeter usage metering
#
# Full stack:
#   pnpm dev:full                 # everything including monitoring

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

MODE="dev"
MONITORING=false
OPENMETER=false
NO_SANDBOX=false
for arg in "$@"; do
  case "$arg" in
    --prod)       MODE="prod" ;;
    --no-sandbox) NO_SANDBOX=true ;;
    --monitoring) MONITORING=true ;;
    --openmeter)  OPENMETER=true ;;
  esac
done

FRONTEND_PID=""
cleanup_trap FRONTEND_PID

ensure_supabase_running "[dev]"
ensure_litellm_running "[dev]"

if [ "$NO_SANDBOX" = false ]; then
  ensure_sandbox_running "[dev]"
fi

# Optional: Prometheus + Grafana monitoring overlay
if [ "$MONITORING" = true ]; then
  echo "[dev] Starting Prometheus + Grafana monitoring..."
  docker compose -f "$SELFHOSTED_DIR/docker-compose.yml" \
    -f "$SELFHOSTED_DIR/docker-compose.monitoring.yml" \
    --env-file "$SELFHOSTED_DIR/.env" up -d
  echo "[dev]   Grafana: http://localhost:3001"
  echo "[dev]   Prometheus: http://localhost:9090"
fi

# Optional: OpenMeter usage metering
if [ "$OPENMETER" = true ]; then
  echo "[dev] Starting OpenMeter usage metering..."
  docker compose -f "$ROOT_DIR/scripts/openmeter/docker-compose.yaml" up -d
  echo "[dev]   OpenMeter: http://localhost:48888"
fi

# Point API at local LiteLLM (not Docker DNS http://litellm:4000)
export LITELLM_URL="http://127.0.0.1:4000"

if [[ "$MODE" == "prod" ]]; then
  echo "[dev] Starting frontend (production build)..."
  pnpm --filter aether-Frontend start &
else
  echo "[dev] Starting frontend..."
  pnpm --filter aether-Frontend dev &
fi
FRONTEND_PID=$!

echo "[dev] Starting API..."
cd "$ROOT_DIR"
AETHER_SKIP_ENSURE_SCHEMA=1 pnpm --filter aether-api "${MODE}"
