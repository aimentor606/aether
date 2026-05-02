#!/usr/bin/env bash
set -euo pipefail
# Start local dev environment (Supabase + API + frontend).
#
# Usage:
#   ./scripts/dev.sh            # dev mode (hot reload)
#   ./scripts/dev.sh --prod     # production build mode

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/lib/common.sh"

MODE="dev"
if [[ "${1:-}" == "--prod" ]]; then
  MODE="prod"
fi

FRONTEND_PID=""
cleanup_trap FRONTEND_PID

ensure_supabase_running "[dev]"

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
