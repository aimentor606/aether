#!/bin/bash
set -e
cd "$(dirname "$0")/.."
source ops/.env
DATE=$(date +%F-%H%M)
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/redis"

echo "🗄️  Backing up PostgreSQL (via supabase-db)..."
docker exec supabase-db pg_dump -U "${DB_ROOT_USER:-postgres}" newapi > "$BACKUP_DIR/postgres/newapi-${DATE}.sql"
docker exec supabase-db pg_dump -U "${DB_ROOT_USER:-postgres}" kong > "$BACKUP_DIR/postgres/kong-${DATE}.sql"

if [ "${LLM_PROXY:-newapi}" = "litellm" ]; then
  docker exec supabase-db pg_dump -U "${DB_ROOT_USER:-postgres}" litellm > "$BACKUP_DIR/postgres/litellm-${DATE}.sql"
fi

echo "📦 Backing up Redis (via supabase-redis)..."
docker exec supabase-redis redis-cli --no-auth-warning -a "$REDIS_PASSWORD" BGSAVE
sleep 1
docker cp supabase-redis:/data/dump.rdb "$BACKUP_DIR/redis/dump-${DATE}.rdb"

echo "🗜️  Compressing..."
tar -czf "$BACKUP_DIR/backup-${DATE}.tar.gz" -C "$BACKUP_DIR" postgres redis

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +7 -delete

# Production: schedule daily backups via cron
# crontab -e → add: 0 3 * * * cd /path/to/deploy && bash ops/backup.sh >> /data/logs/backup.log 2>&1

echo "✅ Backup: $BACKUP_DIR/backup-${DATE}.tar.gz"
