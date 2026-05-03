-- Complete role definitions for self-hosted Supabase.
--
-- This is the single source of truth for all database roles.
-- Used by:
--   - scripts/supabase/ stack (full self-hosted, 15+ services)
--   - scripts/get-aether.sh (minimal install, 4 services)
--   - scripts/deploy/init-db/init-db.sh (production deploy: kong/newapi/litellm)
--
-- Supabase internal roles (managed by the platform):
--   postgres              — superuser, owns all schemas
--   supabase_admin        — admin role for migrations and platform ops
--   supabase_auth_admin   — owns auth schema, used by GoTrue
--   supabase_storage_admin — owns storage schema, used by Storage API
--   supabase_functions_admin — used by Edge Functions runtime
--   supabase_replication_admin — used by Realtime service
--   authenticator         — connection pooler role, switches to anon/authenticated per request
--   anon                  — unauthenticated access (public API)
--   authenticated         — authenticated user access (per-row RLS)
--   service_role          — bypasses RLS, admin-level API access
--   dashboard_user        — Supabase Studio access
--   pgbouncer             — used by Supavisor connection pooler
--   supabase_read_only_user — read-only access for monitoring/analytics
--
-- Production deploy roles (managed by deploy/init-db/):
--   kong                  — Kong API gateway database
--   newapi                — NewAPI/LLM proxy database
--   litellm               — LiteLLM proxy database

-- ═══════════════════════════════════════════════════════
-- Supabase internal roles
-- ═══════════════════════════════════════════════════════

-- Core roles
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
  CREATE ROLE service_role NOLOGIN NOINHERIT NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Authenticator (pooler connection role)
DO $$ BEGIN
  CREATE ROLE authenticator LOGIN NOINHERIT NOCREATEROLE NOCREATEDB;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Admin roles
DO $$ BEGIN
  CREATE ROLE supabase_admin LOGIN CREATEROLE CREATEDB NOINHERIT;
  CREATE ROLE supabase_auth_admin LOGIN NOINHERIT;
  CREATE ROLE supabase_storage_admin LOGIN NOINHERIT;
  CREATE ROLE supabase_functions_admin LOGIN NOINHERIT;
  CREATE ROLE supabase_replication_admin LOGIN REPLICATION NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dashboard & monitoring
DO $$ BEGIN
  CREATE ROLE dashboard_user LOGIN NOINHERIT;
  CREATE ROLE pgbouncer LOGIN NOINHERIT;
  CREATE ROLE supabase_read_only_user LOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, dashboard_user;
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin, service_role;
GRANT USAGE ON SCHEMA storage TO supabase_storage_admin, service_role;
GRANT USAGE ON SCHEMA extensions TO anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════
-- Extensions
-- ═══════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE EXTENSION IF NOT EXISTS pg_crypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS uuid_ossp SCHEMA extensions;
