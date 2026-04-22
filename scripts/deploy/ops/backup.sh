#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env
DATE=$(date +%F-%H%M)
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/redis"

echo "🗄️  Backing up PostgreSQL..."
docker exec postgres pg_dump -U "${DB_ROOT_USER:-root}" newapi > "$BACKUP_DIR/postgres/newapi-${DATE}.sql"
docker exec postgres pg_dump -U "${DB_ROOT_USER:-root}" kong > "$BACKUP_DIR/postgres/kong-${DATE}.sql"

if [ "${LLM_PROXY:-newapi}" = "litellm" ]; then
  docker exec postgres pg_dump -U "${DB_ROOT_USER:-root}" litellm > "$BACKUP_DIR/postgres/litellm-${DATE}.sql"
fi

echo "📦 Backing up Redis..."
docker exec redis sh -c 'REDISCLI_AUTH="$0" redis-cli SAVE' "$REDIS_PASSWORD"
docker cp redis:/data/dump.rdb "$BACKUP_DIR/redis/dump-${DATE}.rdb"

echo "🗜️  Compressing..."
tar -czf "$BACKUP_DIR/backup-${DATE}.tar.gz" -C "$BACKUP_DIR" postgres redis

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +7 -delete

echo "✅ Backup: $BACKUP_DIR/backup-${DATE}.tar.gz"
