-- Rename PostgreSQL schema from acme to aether to match Drizzle pgSchema declaration
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'acme') THEN
    EXECUTE 'ALTER SCHEMA "acme" RENAME TO "aether"';
  END IF;
END $$;
