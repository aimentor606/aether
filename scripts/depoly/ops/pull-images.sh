#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env
echo "Pulling images..."
docker pull kong:3.9.1
docker pull postgres:17
docker pull redis:8.6
docker pull "${NEWAPI_IMAGE:-calciumion/new-api:v0.12.1}"
docker pull kong/deck
echo "✅ All images pulled"
