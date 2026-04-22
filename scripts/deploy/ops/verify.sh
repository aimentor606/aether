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
for svc in postgres redis kong llm-proxy; do
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
echo "=== Authentication ==="
source ops/.env
LLM_PROXY="${LLM_PROXY:-newapi}"
DEFAULT_API_KEY="${DEFAULT_API_KEY:-}"
  litellm) HEALTH_PATH="/v1beta/models" ;;
  *)       HEALTH_PATH="/api/status" ;;
esac
check "No key = 401" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:80${HEALTH_PATH}" \
  "401"
check "Valid key passes Kong auth" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:80${HEALTH_PATH} -H 'X-API-Key: $DEFAULT_API_KEY'" \
  "200"

echo ""
echo "=== Frontend ==="
check "Frontend responds" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/" \
  "200"

echo ""
echo "=== Kong Admin ==="
check "Admin API reachable" \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:8001/status" \
  "200"

echo ""
echo "=== Result: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
