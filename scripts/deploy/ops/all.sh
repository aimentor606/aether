#!/bin/bash
# all.sh — Unified lifecycle manager for the full AetherAI stack.
# Manages both the Supabase infrastructure layer and the deploy service layer.
#
# Usage: ops/all.sh <command> [--skip-infra]
#
# Commands:
#   start     Start full stack (Supabase + deploy services)
#   stop      Stop full stack
#   restart   Restart full stack
#   status    Show full stack status
#   setup     First-time setup (init DBs + dirs + bootstrap + sync)
#   verify    Run health checks
#   reset     Remove deploy containers + logs (keeps Supabase data)
#
# Flags:
#   --skip-infra   Skip Supabase stack management (assume it's already running)

set -euo pipefail
cd "$(dirname "$0")/.."

# ── Config ──────────────────────────────────────────────────────────────
DEPLOY_DIR="$(pwd)"
SCRIPTS_DIR="$(cd "$DEPLOY_DIR/../.." && pwd)"
SUPABASE_DIR="$SCRIPTS_DIR/supabase"
SKIP_INFRA=false

for arg in "$@"; do
  case "$arg" in
    --skip-infra) SKIP_INFRA=true ;;
  esac
done

COMMAND="${1:-help}"
[ "$COMMAND" = "--skip-infra" ] && COMMAND="${2:-help}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠️${NC}  $1"; }
header() { echo -e "\n${BOLD}$1${NC}"; }

# ── Supabase Stack ──────────────────────────────────────────────────────

infra_start() {
  if [ "$SKIP_INFRA" = true ]; then
    header "Skipping Supabase stack (--skip-infra)"
    return
  fi
  header "Starting Supabase stack (PG + Redis)..."
  if docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q "healthy" && \
     docker inspect --format='{{.State.Health.Status}}' supabase-redis 2>/dev/null | grep -q "healthy"; then
    pass "Supabase stack already running"
    return
  fi
  docker compose -f "$SUPABASE_DIR/docker-compose.yml" --env-file "$SUPABASE_DIR/.env" up -d
  echo "  Waiting for Supabase PG..."
  for i in $(seq 1 60); do
    if docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q "healthy"; then
      break
    fi
    sleep 2
  done
  if docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q "healthy"; then
    pass "supabase-db: healthy"
  else
    fail "supabase-db: not healthy after 120s"
    return 1
  fi
  pass "Supabase stack started"
}

infra_stop() {
  if [ "$SKIP_INFRA" = true ]; then return; fi
  header "Stopping Supabase stack..."
  docker compose -f "$SUPABASE_DIR/docker-compose.yml" --env-file "$SUPABASE_DIR/.env" down 2>/dev/null || true
  pass "Supabase stack stopped"
}

infra_status() {
  header "Supabase Infrastructure"
  for svc in supabase-db supabase-redis; do
    local status
    status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
      pass "$svc: healthy"
    elif [ "$status" = "missing" ]; then
      fail "$svc: not running"
    else
      warn "$svc: $status"
    fi
  done
}

# ── Deploy Services ─────────────────────────────────────────────────────

deploy_start() {
  header "Starting deploy services..."
  "$DEPLOY_DIR/ops/start.sh"
}

deploy_stop() {
  header "Stopping deploy services..."
  "$DEPLOY_DIR/ops/stop.sh"
}

deploy_status() {
  header "Deploy Services"
  "$DEPLOY_DIR/ops/status.sh"
}

# ── Composite Commands ──────────────────────────────────────────────────

cmd_start() {
  header "${BOLD}=== AetherAI Full Stack Start ===${NC}"
  infra_start
  deploy_start
  header "=== Stack Started ==="
  cmd_status
}

cmd_stop() {
  header "${BOLD}=== AetherAI Full Stack Stop ===${NC}"
  deploy_stop
  infra_stop
  pass "Full stack stopped"
}

cmd_restart() {
  header "${BOLD}=== AetherAI Full Stack Restart ===${NC}"
  deploy_stop
  infra_stop
  echo ""
  infra_start
  deploy_start
  header "=== Stack Restarted ==="
  cmd_status
}

cmd_status() {
  header "${BOLD}=== AetherAI Full Stack Status ===${NC}"
  infra_status
  echo ""
  deploy_status
}

cmd_setup() {
  header "${BOLD}=== AetherAI First-Time Setup ===${NC}"

  # Step 1: Start infrastructure
  infra_start

  # Step 2: Initialize databases
  header "Initializing deploy databases..."
  if docker exec supabase-db psql -U postgres -lqt 2>/dev/null | cut -d\| -f1 | grep -qw kong; then
    pass "Databases already exist (kong, newapi, litellm)"
  else
    bash "$SUPABASE_DIR/utils/init-deploy-dbs.sh"
    pass "Databases created"
  fi

  # Step 3: Create directories
  header "Creating directory structure..."
  sudo "$DEPLOY_DIR/ops/setup.sh"

  # Step 4: Start deploy services
  deploy_start

  # Step 5: Kong bootstrap
  header "Bootstrapping Kong..."
  "$DEPLOY_DIR/ops/kong-bootstrap.sh"

  # Step 6: Sync Kong config
  header "Syncing Kong routes..."
  "$DEPLOY_DIR/ops/sync-kong.sh"

  # Step 7: Verify
  header "Running verification..."
  "$DEPLOY_DIR/ops/verify.sh"

  header "=== Setup Complete ==="
}

cmd_verify() {
  "$DEPLOY_DIR/ops/verify.sh"
}

cmd_reset() {
  header "${BOLD}=== AetherAI Reset (deploy services only) ===${NC}"
  warn "This will remove deploy containers and logs."
  warn "Supabase data (PG/Redis) is NOT affected."
  echo ""
  read -p "Type 'yes' to confirm: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 0
  fi
  "$DEPLOY_DIR/ops/reset.sh"
}

cmd_help() {
  echo "AetherAI Full Stack Manager"
  echo ""
  echo "Usage: ops/all.sh <command> [--skip-infra]"
  echo ""
  echo "Commands:"
  echo "  start       Start full stack (Supabase + deploy services)"
  echo "  stop        Stop full stack"
  echo "  restart     Restart full stack"
  echo "  status      Show full stack status"
  echo "  setup       First-time setup (init DBs + dirs + bootstrap + sync)"
  echo "  verify      Run health checks"
  echo "  reset       Remove deploy containers + logs (keeps Supabase data)"
  echo ""
  echo "Flags:"
  echo "  --skip-infra   Skip Supabase stack (assume already running)"
}

# ── Main ────────────────────────────────────────────────────────────────

case "$COMMAND" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  setup)   cmd_setup ;;
  verify)  cmd_verify ;;
  reset)   cmd_reset ;;
  help|--help|-h|"") cmd_help ;;
  *)       echo "Unknown command: $COMMAND"; cmd_help; exit 1 ;;
esac
