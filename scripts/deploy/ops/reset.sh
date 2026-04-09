#!/bin/bash
set -e
cd "$(dirname "$0")/.."
echo "⚠️  This will DELETE all data (databases, cache, logs)!"
read -p "Are you sure? Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Aborted."
  exit 0
fi
source ops/.env
BASE_COMPOSE="-f core/db.yml -f core/redis.yml -f core/compose-kong.yml"
case "${LLM_PROXY:-newapi}" in
  litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
  *)       PROXY_COMPOSE="-f core/newapi.yml" ;;
esac
docker compose --env-file ops/.env $BASE_COMPOSE $PROXY_COMPOSE down -v --remove-orphans
echo "Removing logs under /data/logs/..."
sudo rm -rf /data/logs/postgresql/* /data/logs/redis/* /data/logs/kong/* /data/logs/newapi/* /data/logs/litellm/*
echo "✅ Full reset complete. Run ops/start.sh + ops/kong-bootstrap.sh + ops/sync-kong.sh to redeploy."
