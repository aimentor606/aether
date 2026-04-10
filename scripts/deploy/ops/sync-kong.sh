#!/bin/bash
set -e
cd "$(dirname "$0")/.."
if ! curl -sf http://localhost:8001/status >/dev/null 2>&1; then
  echo "❌ Kong Admin API not reachable at localhost:8001"
  echo "   Is Kong running? Try: ops/start.sh"
  exit 1
fi
source ops/.env

case "${LLM_PROXY:-newapi}" in
  litellm) LLM_PROXY_PORT=4000 ;;
  *)       LLM_PROXY_PORT=3000 ;;
esac

FORWARDED_PROTO="http"
[ "${USE_HTTPS}" = "true" ] && FORWARDED_PROTO="https"

echo "Syncing kong.yml (upstream port: ${LLM_PROXY_PORT})..."
docker run --rm \
  --network app-network \
  -v "$(pwd)/core":/files -w /files \
  -e DECK_DEFAULT_API_KEY="$DEFAULT_API_KEY" \
  -e DECK_PREMIUM_API_KEY="$PREMIUM_API_KEY" \
  -e DECK_LLM_PROXY_PORT="$LLM_PROXY_PORT" \
  -e DECK_PUBLIC_HOST="$PUBLIC_HOST" \
  -e DECK_FORWARDED_PROTO="$FORWARDED_PROTO" \
  -e DECK_LITELLM_MASTER_KEY="$LITELLM_MASTER_KEY" \
  kong/deck gateway sync kong.yml \
  --kong-addr http://kong:8001
echo "✅ Kong config synced"
