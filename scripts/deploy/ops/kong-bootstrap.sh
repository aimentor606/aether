#!/bin/bash
set -e
cd "$(dirname "$0")/.."
[ -f ops/.env ] && source ops/.env
ENV_FLAG=""
[ -f ops/.env ] && ENV_FLAG="--env-file ops/.env"

echo "Checking shared PostgreSQL is healthy..."
if ! docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q "healthy"; then
  echo "ERROR: supabase-db is not running. Start the Supabase stack first." >&2
  exit 1
fi

echo "Bootstrapping Kong database..."
docker compose $ENV_FLAG -f core/compose-kong.yml run --rm kong kong migrations bootstrap
echo ""
echo "Restarting Kong..."
docker restart kong
sleep 10
echo "Kong status:"
docker compose $ENV_FLAG -f core/compose-kong.yml ps kong
echo "✅ Kong database bootstrapped"
