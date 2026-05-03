#!/bin/bash
set -e
cd "$(dirname "$0")/.."
ENV_FLAG=""
[ -f ops/.env ] && ENV_FLAG="--env-file ops/.env"

echo "Syncing Kong routes via decK..."
# Use --network container:kong to share Kong's network namespace.
# This lets decK reach Admin API on 127.0.0.1:8001 (container loopback).
docker run --rm \
  --network container:kong \
  $([ -f ops/.env ] && echo "--env-file ops/.env") \
  -v "$(pwd)/core/kong.yml:/kong.yml" \
  kong/deck gateway sync /kong.yml \
  --kong-addr http://127.0.0.1:8001 \
  --verbose 0

echo "✅ Kong routes synced"
