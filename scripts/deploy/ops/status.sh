#!/bin/bash
set -e
cd "$(dirname "$0")/.."
[ -f ops/.env ] && source ops/.env
ENV_FLAG=""
[ -f ops/.env ] && ENV_FLAG="--env-file ops/.env"

BASE_COMPOSE="-f core/compose-kong.yml"
PROXY_COMPOSE=""
case "${LLM_PROXY:-}" in
  newapi)  PROXY_COMPOSE="-f core/newapi.yml" ;;
  litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
esac

echo "=== Shared Infrastructure (Supabase) ==="
echo "  supabase-db:    $(docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null || echo 'not found')"
echo "  supabase-redis: $(docker inspect --format='{{.State.Health.Status}}' supabase-redis 2>/dev/null || echo 'not found')"
echo ""
echo "=== Deploy Services (LLM_PROXY=${LLM_PROXY:-none}) ==="
if [ -n "$ENV_FLAG" ]; then
  docker compose $ENV_FLAG $BASE_COMPOSE $PROXY_COMPOSE ps -a 2>/dev/null || docker compose $ENV_FLAG $BASE_COMPOSE ps -a
else
  echo "  (ops/.env not found — showing container status only)"
  for svc in kong llm-proxy; do
    status=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$status" = "healthy" ]; then
      echo "  ✅ $svc: healthy"
    elif [ "$status" = "missing" ]; then
      echo "  ❌ $svc: not running"
    else
      echo "  ⚠️  $svc: $status"
    fi
  done
fi
echo ""
echo "=== Kong Routes ==="
curl -s http://localhost:8001/routes 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; [print(f'  {r[\"name\"]}: {r.get(\"paths\",[])} -> {r[\"service\"][\"id\"][:8]}') for r in data]" 2>/dev/null || echo "  Kong not reachable"
echo ""
echo "=== Kong Plugins ==="
curl -s http://localhost:8001/plugins 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; [print(f'  {p[\"name\"]} ({\"global\" if not p.get(\"service\") else p[\"service\"][\"id\"][:8]}) [{\"✅\" if p[\"enabled\"] else \"❌\"}]') for p in data]" 2>/dev/null || echo "  Kong not reachable"
