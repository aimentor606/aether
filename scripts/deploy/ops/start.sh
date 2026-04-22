#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env

# Auto-derive FORWARDED_PROTO from USE_HTTPS
# (matches logic in sync-kong.sh — keep in sync)
FORWARDED_PROTO="http"
[ "${USE_HTTPS}" = "true" ] && FORWARDED_PROTO="https"
export FORWARDED_PROTO

BASE_COMPOSE="-f core/db.yml -f core/redis.yml -f core/compose-kong.yml"

case "${LLM_PROXY:-newapi}" in
  litellm) PROXY_COMPOSE="-f core/litellm.yml" ;;
  *)       PROXY_COMPOSE="-f core/newapi.yml" ;;
esac

echo "Starting services (LLM_PROXY=${LLM_PROXY:-newapi}, FORWARDED_PROTO=${FORWARDED_PROTO})..."
docker compose --env-file ops/.env $BASE_COMPOSE $PROXY_COMPOSE up -d
echo "Waiting for services to become healthy..."
DEADLINE=$((SECONDS + 120))
for svc in postgres redis kong llm-proxy; do
  ELAPSED=0
  while [ "$ELAPSED" -lt 60 ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$STATUS" = "healthy" ]; then
      echo "  ✅ $svc: healthy (${ELAPSED}s)"
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done
  if [ "$STATUS" != "healthy" ]; then
    echo "  ⚠️  $svc: $STATUS (may still be starting)"
  fi
done
docker compose --env-file ops/.env $BASE_COMPOSE $PROXY_COMPOSE ps
echo "✅ All services started"
