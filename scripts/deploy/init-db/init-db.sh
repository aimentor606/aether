#!/bin/bash
# init-db.sh
# Parameterized database initialization — reads passwords from env vars.
# Auto-executed on first start via /docker-entrypoint-initdb.d/
#
# Required env vars (set in ops/.env):
#   DB_ROOT_USER, KONG_PG_PASSWORD, NEWAPI_DB_PASSWORD, LITELLM_DB_PASSWORD

set -euo pipefail

: "${KONG_PG_PASSWORD:?KONG_PG_PASSWORD is required}"
: "${NEWAPI_DB_PASSWORD:?NEWAPI_DB_PASSWORD is required}"
: "${LITELLM_DB_PASSWORD:?LITELLM_DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "${DB_ROOT_USER:-postgres}" --dbname postgres <<-EOSQL
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
