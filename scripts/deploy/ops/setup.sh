#!/bin/bash
# setup.sh
# Purpose: Create directory structure and set permissions for /data

set -e

DATA_ROOT="/data"

echo "📂 Creating directory structure under ${DATA_ROOT}..."

# Data directories
mkdir -p ${DATA_ROOT}/postgres
mkdir -p ${DATA_ROOT}/redis
mkdir -p ${DATA_ROOT}/kong/cache
mkdir -p ${DATA_ROOT}/uploads/newapi

# Log directories
mkdir -p ${DATA_ROOT}/logs/postgresql
mkdir -p ${DATA_ROOT}/logs/redis
mkdir -p ${DATA_ROOT}/logs/kong
mkdir -p ${DATA_ROOT}/logs/newapi
mkdir -p ${DATA_ROOT}/logs/litellm

echo "🔒 Setting permissions..."

# PostgreSQL (UID 999 — postgres user inside container)
chown -R 999:999 ${DATA_ROOT}/postgres
chown -R 999:999 ${DATA_ROOT}/logs/postgresql

# Redis (UID 999 — redis user inside container)
chown -R 999:999 ${DATA_ROOT}/redis
chown -R 999:999 ${DATA_ROOT}/logs/redis

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
echo "  ├── postgres/            # PostgreSQL data"
echo "  ├── redis/               # Redis AOF data"
echo "  ├── kong/cache/          # Kong proxy cache"
echo "  ├── uploads/newapi/      # NewAPI uploads"
echo "  └── logs/"
echo "      ├── postgresql/      # PostgreSQL logs"
echo "      ├── redis/           # Redis logs"
echo "      ├── kong/            # Kong access/error logs"
echo "      └── newapi/          # NewAPI application logs"
