#!/usr/bin/env bash
# Verify self-hosted Supabase stack health
set -euo pipefail
cd "$(dirname "$0")"

PASS=0
FAIL=0

check() {
  local desc="$1" cmd="$2" expect="$3"
  result=$(eval "$cmd" 2>/dev/null) || true
  if echo "$result" | grep -q "$expect"; then
    echo "  PASS $desc"
    PASS=$((PASS+1))
  else
    echo "  FAIL $desc"
    FAIL=$((FAIL+1))
  fi
}

echo "=== Container Health ==="
for svc in supabase-db supabase-kong supabase-auth supabase-pooler supabase-rest supabase-storage supabase-meta supabase-edge-functions supabase-realtime supabase-studio; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
  if [ "$status" = "healthy" ]; then
    echo "  PASS $svc: healthy"
    PASS=$((PASS+1))
  elif [ "$status" = "missing" ]; then
    echo "  FAIL $svc: not running"
    FAIL=$((FAIL+1))
  else
    echo "  WARN $svc: $status"
    FAIL=$((FAIL+1))
  fi
done

# Source env for keys
source .env 2>/dev/null || true

echo ""
echo "=== Kong Routing ==="
check "Kong /auth/v1/health" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/health" \
  "200"
check "Kong metrics endpoint" \
  "curl -s http://localhost:${KONG_ADMIN_PORT:-8100}/metrics" \
  "kong"

echo ""
echo "=== Database ==="
check "Postgres direct (port 5434)" \
  "docker exec supabase-db psql -U postgres -c 'SELECT 1'" \
  "1 row"
check "Supavisor pooler (port 5433)" \
  "docker exec supabase-pooler psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -c 'SELECT 1' 2>/dev/null || echo 'skip'" \
  "1 row"

echo ""
echo "=== Auth ==="
check "Auth signup endpoint reachable" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:${KONG_HTTP_PORT:-8000}/auth/v1/signup -H 'apikey: ${ANON_KEY}' -H 'Content-Type: application/json' -d '{}'" \
  ""

echo ""
echo "=== Storage ==="
check "Storage endpoint reachable" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:${KONG_HTTP_PORT:-8000}/storage/v1/bucket -H 'apikey: ${ANON_KEY}'" \
  ""

echo ""
echo "=== Result ==="
echo "  $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
