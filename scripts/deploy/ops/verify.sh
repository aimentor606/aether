#!/bin/bash
cd "$(dirname "$0")/.."
PASS=0
FAIL=0
check() {
  local desc="$1" cmd="$2" expect="$3"
  result=$(eval "$cmd" 2>/dev/null)
  if echo "$result" | grep -q "$expect"; then
    echo "  ✅ $desc"
    PASS=$((PASS+1))
  else
    echo "  ❌ $desc"
    FAIL=$((FAIL+1))
  fi
}
echo "=== Container Health ==="
echo "  --- Shared Infrastructure (Supabase) ---"
for svc in supabase-db supabase-redis; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
  if [ "$status" = "healthy" ]; then
    echo "  ✅ $svc: healthy"
    PASS=$((PASS+1))
  elif [ "$status" = "missing" ]; then
    echo "  ❌ $svc: not running"
    FAIL=$((FAIL+1))
  else
    echo "  ⚠️  $svc: $status"
    FAIL=$((FAIL+1))
  fi
done

echo "  --- Deploy Services ---"
[ -f ops/.env ] && source ops/.env
DEPLOY_SERVICES="kong"
case "${LLM_PROXY:-}" in
  newapi|litellm) DEPLOY_SERVICES="kong llm-proxy" ;;
esac
for svc in $DEPLOY_SERVICES; do
  status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
  if [ "$status" = "healthy" ]; then
    echo "  ✅ $svc: healthy"
    PASS=$((PASS+1))
  elif [ "$status" = "missing" ]; then
    echo "  ❌ $svc: not running"
    FAIL=$((FAIL+1))
  else
    echo "  ⚠️  $svc: $status"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "=== CORS Preflight ==="
check "/api/ CORS" \
  "curl -s -o /dev/null -D - -X OPTIONS http://localhost:80/api/log -H 'Origin: https://www.aimentor.top' -H 'Access-Control-Request-Method: GET'" \
  "Access-Control-Allow-Origin"
check "/v1beta/ CORS" \
  "curl -s -o /dev/null -D - -X OPTIONS http://localhost:80/v1beta/models -H 'Origin: https://www.aimentor.top' -H 'Access-Control-Request-Method: GET'" \
  "Access-Control-Allow-Origin"

echo ""
echo "=== LLM Proxy Routing ==="
case "${LLM_PROXY:-}" in
  newapi)
    check "Health endpoint = 200" \
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/status" \
      "200"
    check "Kong routes to llm-proxy" \
      "curl -s http://localhost:80/api/status" \
      "success"
    ;;
  litellm)
    check "Health endpoint = 200" \
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/health/liveliness" \
      "200"
    ;;
  *)
    echo "  ⏭️  LLM proxy not enabled (LLM_PROXY is empty or 'none')"
    ;;
esac

echo ""
echo "=== Frontend ==="
case "${LLM_PROXY:-}" in
  newapi|litellm)
    check "Frontend responds" \
      "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/" \
      "200"
    ;;
  *)
    echo "  ⏭️  Frontend check skipped (no LLM proxy)"
    ;;
esac

echo ""
echo "=== Kong Admin ==="
check "Admin API reachable" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/status" \
  "200"

echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
