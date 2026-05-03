#!/bin/bash
set -e
cd "$(dirname "$0")/.."

if [ -n "$1" ]; then
  echo "Restarting $1..."
  docker restart "$1"
else
  [ -f ops/.env ] && source ops/.env
  ENV_FLAG=""
  [ -f ops/.env ] && ENV_FLAG="--env-file ops/.env"
  BASE_COMPOSE="-f core/compose-kong.yml"
  case "${LLM_PROXY:-}" in
    newapi)  PROXY_COMPOSE="-f core/newapi.yml" ;;
    litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
    *)       PROXY_COMPOSE="" ;;
  esac
  echo "Restarting all services..."
  docker compose $ENV_FLAG $BASE_COMPOSE $PROXY_COMPOSE restart
fi
echo "✅ Restart complete"
