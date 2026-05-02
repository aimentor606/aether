#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "⚠️  This will DELETE deploy service containers and logs (PG/Redis are shared with Supabase and NOT touched)!"
read -p "Are you sure? Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi
source ops/.env

# Stop and remove deploy services only (not supabase-db/supabase-redis)
BASE_COMPOSE="-f core/compose-kong.yml"
case "${LLM_PROXY:-}" in
  newapi)  PROXY_COMPOSE="-f core/newapi.yml" ;;
  litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
  *)       PROXY_COMPOSE="" ;;
esac
docker compose --env-file ops/.env $BASE_COMPOSE $PROXY_COMPOSE down --remove-orphans

echo "Removing deploy logs under ${DATA_ROOT:-/data}/logs/..."
sudo rm -rf "${DATA_ROOT:-/data}"/logs/kong/* "${DATA_ROOT:-/data}"/logs/newapi/* "${DATA_ROOT:-/data}"/logs/litellm/*
echo "✅ Reset complete. Run ops/start.sh + ops/kong-bootstrap.sh + ops/sync-kong.sh to redeploy."
