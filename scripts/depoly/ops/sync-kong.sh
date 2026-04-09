# #!/bin/bash
# set -e
# cd "$(dirname "$0")/.."
# if ! curl -sf http://localhost:8001/status >/dev/null 2>&1; then
#   echo "❌ Kong Admin API not reachable at localhost:8001"
#   echo "   Is Kong running? Try: ops/start.sh"
#   exit 1
# fi
# source ops/.env
# export DECK_DEFAULT_API_KEY="$DEFAULT_API_KEY"
# export DECK_PREMIUM_API_KEY="$PREMIUM_API_KEY"
# echo "Syncing kong.yml..."
# docker run --rm \
#   --network app-network \
#   -v "$(pwd)/core":/files -w /files \
#   -e DECK_DEFAULT_API_KEY="$DECK_DEFAULT_API_KEY" \
#   -e DECK_PREMIUM_API_KEY="$DECK_PREMIUM_API_KEY" \
#   kong/deck gateway sync kong.yml \
#   --kong-addr http://kong:8001
# echo "✅ Kong config synced"

#!/bin/bash
set -e
cd "$(dirname "$0")/.."
if ! curl -sf http://localhost:8001/status >/dev/null 2>&1; then
  echo "❌  Kong Admin API not reachable at localhost:8001"
  echo "   Is Kong running? Try: ops/start.sh"
  exit 1
fi
source ops/.env
export DECK_DEFAULT_API_KEY="$DEFAULT_API_KEY"
export DECK_PREMIUM_API_KEY="$PREMIUM_API_KEY"
echo "Syncing kong.yml..."
docker run --rm \
  -v "$(pwd)/core":/files -w /files \
   --network app-network \
  -e DECK_DEFAULT_API_KEY="$DECK_DEFAULT_API_KEY" \
  -e DECK_PREMIUM_API_KEY="$DECK_PREMIUM_API_KEY" \
  kong/deck gateway sync kong.yml \
   --kong-addr http://kong:8001
echo "✅  Kong config synced"
