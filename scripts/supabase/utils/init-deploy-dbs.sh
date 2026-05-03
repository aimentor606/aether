#!/bin/bash
# Create production deploy databases (kong, newapi, litellm) in the shared Supabase PG.
#
# This replaces the old deploy/init-db/init-db.sh which ran as a docker-entrypoint.
# Now runs against the shared Supabase PG container (supabase-db).
#
# Required env vars (set in deploy/ops/.env):
#   KONG_PG_PASSWORD, NEWAPI_DB_PASSWORD, LITELLM_DB_PASSWORD
#
# Usage:
#   bash init-deploy-dbs.sh                          # uses deploy/ops/.env
#   KONG_PG_PASSWORD=x ... bash init-deploy-dbs.sh   # explicit vars

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load deploy env if available
DEPLOY_ENV="$SCRIPT_DIR/../../deploy/ops/.env"
if [ -f "$DEPLOY_ENV" ]; then
  set -a
  source "$DEPLOY_ENV"
  set +a
fi

: "${KONG_PG_PASSWORD:?KONG_PG_PASSWORD is required}"
: "${NEWAPI_DB_PASSWORD:?NEWAPI_DB_PASSWORD is required}"
: "${LITELLM_DB_PASSWORD:?LITELLM_DB_PASSWORD is required}"

# OpenMeter is optional — only create DB when password is provided
OPENMETER_DB_PASSWORD="${OPENMETER_DB_PASSWORD:-}"
OPENMETER_DB_USER="${OPENMETER_DB_USER:-openmeter}"
OPENMETER_DB_DATABASE="${OPENMETER_DB_DATABASE:-openmeter}"

# Verify supabase-db is running
if ! docker inspect --format='{{.State.Health.Status}}' supabase-db 2>/dev/null | grep -q "healthy"; then
  echo "ERROR: supabase-db is not running. Start the Supabase stack first." >&2
  exit 1
fi

DB_USER="${DB_ROOT_USER:-postgres}"

echo "Creating deploy databases in shared Supabase PG..."

docker exec -i supabase-db psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname postgres <<-EOSQL
	-- ========== Kong Database ==========
	SELECT 'CREATE DATABASE kong' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kong')\gexec

	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kong') THEN
	    CREATE ROLE kong LOGIN PASSWORD '${KONG_PG_PASSWORD}';
	  END IF;
	END
	\$\$;

	GRANT ALL PRIVILEGES ON DATABASE kong TO kong;

	\c kong
	GRANT ALL ON SCHEMA public TO kong;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kong;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kong;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO kong;

	-- ========== NewAPI Database ==========
	\c postgres
	SELECT 'CREATE DATABASE newapi' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'newapi')\gexec

	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'newapi') THEN
	    CREATE ROLE newapi LOGIN PASSWORD '${NEWAPI_DB_PASSWORD}';
	  END IF;
	END
	\$\$;

	GRANT ALL PRIVILEGES ON DATABASE newapi TO newapi;

	\c newapi
	GRANT ALL ON SCHEMA public TO newapi;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO newapi;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO newapi;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO newapi;

	-- ========== LiteLLM Database ==========
	\c postgres
	SELECT 'CREATE DATABASE litellm' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'litellm')\gexec

	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'litellm') THEN
	    CREATE ROLE litellm LOGIN PASSWORD '${LITELLM_DB_PASSWORD}';
	  END IF;
	END
	\$\$;

	GRANT ALL PRIVILEGES ON DATABASE litellm TO litellm;

	\c litellm
	GRANT ALL ON SCHEMA public TO litellm;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO litellm;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO litellm;
	ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO litellm;
EOSQL

# ========== OpenMeter Database (optional) ==========
if [ -n "$OPENMETER_DB_PASSWORD" ]; then
  echo "Creating OpenMeter database (OPENMETER_DB_PASSWORD provided)..."
  docker exec -i supabase-db psql -v ON_ERROR_STOP=1 --username "$DB_USER" --dbname postgres <<-EOSQL
		SELECT 'CREATE DATABASE ${OPENMETER_DB_DATABASE}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${OPENMETER_DB_DATABASE}')\gexec

		DO \$\$
		BEGIN
		  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${OPENMETER_DB_USER}') THEN
		    CREATE ROLE ${OPENMETER_DB_USER} LOGIN PASSWORD '${OPENMETER_DB_PASSWORD}';
		  END IF;
		END
		\$\$;

		GRANT ALL PRIVILEGES ON DATABASE ${OPENMETER_DB_DATABASE} TO ${OPENMETER_DB_USER};

		\c ${OPENMETER_DB_DATABASE}
		GRANT ALL ON SCHEMA public TO ${OPENMETER_DB_USER};
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${OPENMETER_DB_USER};
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${OPENMETER_DB_USER};
		ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${OPENMETER_DB_USER};
	EOSQL
fi

DB_LIST="kong, newapi, litellm"
[ -n "$OPENMETER_DB_PASSWORD" ] && DB_LIST="$DB_LIST, openmeter"
echo "Done. Created databases: $DB_LIST"
