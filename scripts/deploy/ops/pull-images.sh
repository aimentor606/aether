#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env
echo "Pulling images..."
docker pull kong:3.9.1
docker pull "${NEWAPI_IMAGE:-calciumion/new-api:v0.12.1}"
docker pull kong/deck
# Note: PG and Redis images are managed by the Supabase stack (scripts/supabase/docker-compose.yml)
echo "✅ All images pulled"
