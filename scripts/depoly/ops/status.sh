#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env

BASE_COMPOSE="-f core/db.yml -f core/redis.yml -f core/compose-kong.yml"
case "${LLM_PROXY:-newapi}" in
  litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
  *)       PROXY_COMPOSE="-f core/newapi.yml" ;;
esac

echo "=== Container Status (LLM_PROXY=${LLM_PROXY:-newapi}) ==="
docker compose --env-file ops/.env $BASE_COMPOSE $PROXY_COMPOSE ps -a
echo ""
echo "=== Kong Routes ==="
curl -s http://localhost:8001/routes 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; [print(f'  {r[\"name\"]}: {r.get(\"paths\",[])} -> {r[\"service\"][\"id\"][:8]}') for r in data]" 2>/dev/null || echo "  Kong not reachable"
echo ""
echo "=== Kong Plugins ==="
curl -s http://localhost:8001/plugins 2>/dev/null | python3 -c "import sys,json; data=json.load(sys.stdin)['data']; [print(f'  {p[\"name\"]} ({\"global\" if not p.get(\"service\") else p[\"service\"][\"id\"][:8]}) [{\"✅\" if p[\"enabled\"] else \"❌\"}]') for p in data]" 2>/dev/null || echo "  Kong not reachable"
