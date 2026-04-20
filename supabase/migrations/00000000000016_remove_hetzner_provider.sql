DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'aether'
      AND t.typname = 'sandbox_provider'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM aether.sandboxes
      WHERE provider::text = 'hetzner'
    ) THEN
      RAISE EXCEPTION 'Cannot remove hetzner sandbox provider enum while Hetzner sandboxes still exist';
    END IF;

    ALTER TYPE aether.sandbox_provider RENAME TO sandbox_provider_old;
    CREATE TYPE aether.sandbox_provider AS ENUM ('daytona', 'local_docker', 'justavps');

    ALTER TABLE aether.sandboxes
      ALTER COLUMN provider DROP DEFAULT;

    ALTER TABLE aether.sandboxes
      ALTER COLUMN provider TYPE aether.sandbox_provider
      USING provider::text::aether.sandbox_provider;

    ALTER TABLE aether.sandboxes
      ALTER COLUMN provider SET DEFAULT 'daytona';

    ALTER TABLE aether.server_entries
      ALTER COLUMN provider TYPE aether.sandbox_provider
      USING provider::text::aether.sandbox_provider;

    ALTER TABLE aether.pool_resources
      ALTER COLUMN provider TYPE aether.sandbox_provider
      USING provider::text::aether.sandbox_provider;

    ALTER TABLE aether.pool_sandboxes
      ALTER COLUMN provider TYPE aether.sandbox_provider
      USING provider::text::aether.sandbox_provider;

    DROP TYPE aether.sandbox_provider_old;
  END IF;
END $$;
