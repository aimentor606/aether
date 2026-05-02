#!/bin/bash
# setup.sh
# Purpose: Create directory structure and set permissions for /data
# Note: PG and Redis data live inside the Supabase stack (scripts/supabase/volumes/)

set -e

DATA_ROOT="/data"

# Create Docker network if not exists
echo "🌐 Creating Docker network..."
docker network inspect app-network >/dev/null 2>&1 || docker network create app-network

echo "📂 Creating directory structure under ${DATA_ROOT}..."

# Data directories (only deploy-specific services)
mkdir -p ${DATA_ROOT}/kong/cache
mkdir -p ${DATA_ROOT}/uploads/newapi

# Log directories
mkdir -p ${DATA_ROOT}/logs/kong
mkdir -p ${DATA_ROOT}/logs/newapi
mkdir -p ${DATA_ROOT}/logs/litellm

# OpenMeter data directories
mkdir -p ${DATA_ROOT}/clickhouse
mkdir -p ${DATA_ROOT}/kafka

echo "🔒 Setting permissions..."

# Kong (UID 1001 — kong user inside container)
chown -R 1001:1001 ${DATA_ROOT}/kong
chown -R 1001:1001 ${DATA_ROOT}/logs/kong

# NewAPI runs as root (UID 0) inside container, any ownership works
chown -R 1000:1000 ${DATA_ROOT}/logs/newapi
chown -R 1000:1000 ${DATA_ROOT}/uploads/newapi

# LiteLLM runs as root inside container, any ownership works
chown -R 1000:1000 ${DATA_ROOT}/logs/litellm

echo "✅ Setup complete! Directory structure under ${DATA_ROOT}:"
echo ""
echo "  ${DATA_ROOT}/"
echo "  ├── kong/cache/          # Kong proxy cache"
echo "  ├── uploads/newapi/      # NewAPI uploads"
echo "  ├── clickhouse/          # ClickHouse analytics data"
echo "  ├── kafka/               # Kafka event stream data"
echo "  └── logs/"
echo "      ├── kong/            # Kong access/error logs"
echo "      ├── newapi/          # NewAPI application logs"
echo "      └── litellm/         # LiteLLM logs"
