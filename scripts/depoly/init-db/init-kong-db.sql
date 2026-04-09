-- init-kong-db.sql
-- Create dedicated databases and users for Kong and newapi

-- ========== Kong Database ==========

-- Create kong database if not exists
SELECT 'CREATE DATABASE kong' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kong')\gexec

-- Create kong user if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'kong') THEN
    CREATE ROLE kong LOGIN PASSWORD 'aetherai@kong8864';
  END IF;
END
$$;

-- Grant privileges
\c kong
GRANT ALL PRIVILEGES ON DATABASE kong TO kong;
GRANT ALL ON SCHEMA public TO kong;

-- Set default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kong;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kong;

-- ========== newapi Database ==========

-- Switch back to default database to create newapi db
\c postgres
SELECT 'CREATE DATABASE newapi' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'newapi')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'newapi') THEN
    CREATE ROLE newapi LOGIN PASSWORD 'aetherai@newapi8864';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE newapi TO newapi;
\c newapi
GRANT ALL ON SCHEMA public TO newapi;
-- ========== LiteLLM Database ==========

\c postgres
SELECT 'CREATE DATABASE litellm' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'litellm')\gexec

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'litellm') THEN
    CREATE ROLE litellm LOGIN PASSWORD 'aetherai@litellm8864';
  END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE litellm TO litellm;
\c litellm
GRANT ALL ON SCHEMA public TO litellm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO litellm;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO litellm;
