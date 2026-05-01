#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SELFHOSTED_DIR="$ROOT_DIR/scripts/supabase"

FRONTEND_PID=""

cleanup() {
  local exit_code=$?
  trap - EXIT INT TERM

  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
    wait "$FRONTEND_PID" 2>/dev/null || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT INT TERM

echo "[start] Ensuring local Supabase is running..."
if ! docker info >/dev/null 2>&1; then
  echo "[start] ERROR: Docker daemon is not running"
  exit 1
fi

# Start self-hosted Supabase stack if not already running
if ! docker compose -f "$SELFHOSTED_DIR/docker-compose.yml" --env-file "$SELFHOSTED_DIR/.env" ps --status running 2>/dev/null | grep -q "supabase-kong"; then
  echo "[start] Starting self-hosted Supabase stack..."
  docker compose -f "$SELFHOSTED_DIR/docker-compose.yml" --env-file "$SELFHOSTED_DIR/.env" up -d
fi

echo "[start] Waiting for Postgres on 127.0.0.1:5434..."
python3 - <<'PY'
import socket
import sys
import time

deadline = time.time() + 120
while time.time() < deadline:
    try:
        with socket.create_connection(("127.0.0.1", 5434), timeout=1):
            sys.exit(0)
    except OSError:
        time.sleep(1)

print("[start] ERROR: Timed out waiting for Supabase Postgres on 127.0.0.1:5434", file=sys.stderr)
sys.exit(1)
PY

echo "[start] Starting frontend (production build)..."
pnpm --filter aether-Computer-Frontend start &
FRONTEND_PID=$!

echo "[start] Starting API..."
cd "$ROOT_DIR"
AETHER_SKIP_ENSURE_SCHEMA=1 pnpm --filter aether-api start
