#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env
echo "Bootstrapping Kong database..."
docker compose --env-file ops/.env -f core/db.yml -f core/compose-kong.yml run --rm kong kong migrations bootstrap
echo ""
echo "Restarting Kong..."
docker restart kong
sleep 10
echo "Kong status:"
docker compose --env-file ops/.env -f core/db.yml -f core/compose-kong.yml ps kong
echo "✅ Kong database bootstrapped"
