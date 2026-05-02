#!/bin/bash
set -e
cd "$(dirname "$0")/.."
[ -f ops/.env ] && source ops/.env
ENV_FLAG=""
[ -f ops/.env ] && ENV_FLAG="--env-file ops/.env"

BASE_COMPOSE="-f core/compose-kong.yml"

case "${LLM_PROXY:-}" in
  newapi)  PROXY_COMPOSE="-f core/newapi.yml" ;;
  litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
  *)       PROXY_COMPOSE="" ;;
esac

docker compose $ENV_FLAG $BASE_COMPOSE $PROXY_COMPOSE down
echo "✅ All services stopped"
