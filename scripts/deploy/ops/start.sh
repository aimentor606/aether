#!/bin/bash
set -e
cd "$(dirname "$0")/.."

if [ -f ops/.env ]; then
  source ops/.env
  ENV_FLAG="--env-file ops/.env"

  # Security: check .env file permissions
  ENV_PERM=$(stat -f '%Lp' ops/.env 2>/dev/null || stat -c '%a' ops/.env 2>/dev/null || echo "000")
  if [ "$((ENV_PERM & 007))" -ne 0 ]; then
    echo "WARNING: ops/.env is group/other readable (mode=$ENV_PERM). Run: chmod 600 ops/.env" >&2
  fi

  # Validate that critical secrets are not still placeholder values
  SECRET_VARS="KONG_PG_PASSWORD SESSION_SECRET"
  case "${LLM_PROXY:-}" in
    newapi)  SECRET_VARS="$SECRET_VARS NEWAPI_DB_PASSWORD DEFAULT_API_KEY" ;;
    litellm) SECRET_VARS="$SECRET_VARS LITELLM_DB_PASSWORD LITELLM_MASTER_KEY LITELLM_SALT_KEY DEFAULT_API_KEY" ;;
  esac
  for var in $SECRET_VARS; do
    if [ "${!var}" = "CHANGE_ME" ] || [ "${!var}" = "sk-CHANGE_ME" ]; then
      echo "ERROR: $var is still set to a placeholder value. Edit ops/.env before starting." >&2
      exit 1
    fi
  done

  # Redis password is mandatory for production
  if [ -z "${REDIS_PASSWORD:-}" ]; then
    echo "ERROR: REDIS_PASSWORD is empty. Set a strong password in ops/.env." >&2
    exit 1
  fi

  # Cross-stack: REDIS_PASSWORD must match supabase/.env
  SUPABASE_REDIS=$(grep '^REDIS_PASSWORD=' "$(dirname "$0")/../../supabase/.env" 2>/dev/null | cut -d= -f2 || true)
  if [ -n "$SUPABASE_REDIS" ] && [ "$REDIS_PASSWORD" != "$SUPABASE_REDIS" ]; then
    echo "ERROR: REDIS_PASSWORD mismatch between deploy/ops/.env and supabase/.env" >&2
    exit 1
  fi

  # Validate SSL certs when HTTPS is enabled
  if [ "${USE_HTTPS}" = "true" ]; then
    for cert in ../ssl/fullchain.pem ../ssl/privkey.pem; do
      if [ ! -f "$cert" ]; then
        echo "ERROR: USE_HTTPS=true but $cert not found. Provide SSL certs or set USE_HTTPS=false." >&2
        exit 1
      fi
    done
  fi
else
  ENV_FLAG=""
  echo "WARNING: ops/.env not found, running without env file (dev mode)" >&2
fi

# Auto-derive FORWARDED_PROTO from USE_HTTPS
FORWARDED_PROTO="http"
[ "${USE_HTTPS:-false}" = "true" ] && FORWARDED_PROTO="https"
export FORWARDED_PROTO

# Ensure Supabase stack (PG + Redis) is running
echo "Checking Supabase stack (shared PG + Redis)..."
if ! docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q "healthy"; then
  echo "ERROR: supabase-db is not running. Start the Supabase stack first." >&2
  echo "  Run: docker compose -f scripts/supabase/docker-compose.yml --env-file scripts/supabase/.env up -d" >&2
  exit 1
fi
if ! docker inspect --format='{{.State.Health.Status}}' supabase-redis 2>/dev/null | grep -q "healthy"; then
  echo "ERROR: supabase-redis is not running. Start the Supabase stack first." >&2
  exit 1
fi
echo "  supabase-db: healthy"
echo "  supabase-redis: healthy"

BASE_COMPOSE="-f core/compose-kong.yml"

PROXY_COMPOSE=""
WAIT_SERVICES="kong"
case "${LLM_PROXY:-}" in
  newapi)  PROXY_COMPOSE="-f core/newapi.yml";  WAIT_SERVICES="kong llm-proxy" ;;
  litellm) PROXY_COMPOSE="-f core/litellm.yml"; WAIT_SERVICES="kong llm-proxy" ;;
  *)       ;; # empty or "none" — skip LLM proxy
esac

# OpenMeter usage metering (optional — only started when OPENMETER_URL is set)
OPENMETER_COMPOSE=""
if [ -f "core/openmeter.yml" ] && [ -n "${OPENMETER_URL:-}" ]; then
  OPENMETER_COMPOSE="-f core/openmeter.yml"
  WAIT_SERVICES="$WAIT_SERVICES clickhouse kafka openmeter"
fi

echo "Starting services (LLM_PROXY=${LLM_PROXY:-none}, FORWARDED_PROTO=${FORWARDED_PROTO})..."
docker compose $ENV_FLAG $BASE_COMPOSE $PROXY_COMPOSE $OPENMETER_COMPOSE up -d
echo "Waiting for services to become healthy..."
for svc in $WAIT_SERVICES; do
  ELAPSED=0
  while [ "$ELAPSED" -lt 60 ]; do
    STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$svc" 2>/dev/null || echo "missing")
    if [ "$STATUS" = "healthy" ]; then
      echo "  ✅ $svc: healthy (${ELAPSED}s)"
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done
  if [ "$STATUS" != "healthy" ]; then
    echo "  ⚠️  $svc: $STATUS (may still be starting)"
  fi
done
docker compose $ENV_FLAG $BASE_COMPOSE $PROXY_COMPOSE $OPENMETER_COMPOSE ps 2>/dev/null || true

# Sync Kong routes (idempotent — safe on every start)
if [ -f core/kong.yml ] && [ -n "$ENV_FLAG" ]; then
  echo "Syncing Kong routes..."
  bash ops/sync-kong.sh
fi

echo "✅ All services started"
