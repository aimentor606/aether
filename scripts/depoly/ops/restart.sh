#!/bin/bash
set -e
cd "$(dirname "$0")/.."

if [ -n "$1" ]; then
  echo "Restarting $1..."
  docker restart "$1"
else
  source ops/.env
  BASE_COMPOSE="-f core/db.yml -f core/redis.yml -f core/compose-kong.yml"
  case "${LLM_PROXY:-newapi}" in
    litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
    *)       PROXY_COMPOSE="-f core/newapi.yml" ;;
  esac
  echo "Restarting all services..."
  docker compose --env-file ops/.env $BASE_COMPOSE $PROXY_COMPOSE restart
fi
echo "✅ Restart complete"
