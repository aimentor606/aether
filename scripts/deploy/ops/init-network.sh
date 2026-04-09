#!/bin/bash
set -e
cd "$(dirname "$0")/.."
# Create app-network if not exists
docker network inspect app-network >/dev/null 2>&1 || docker network create app-network
# Create /data directories for all services
sudo mkdir -p /data/postgres /data/redis /data/kong/cache \
  /data/logs/postgresql /data/logs/redis /data/logs/kong /data/logs/newapi /data/logs/litellm \
  /data/uploads/newapi
echo "✅ Network and /data directories ready"
