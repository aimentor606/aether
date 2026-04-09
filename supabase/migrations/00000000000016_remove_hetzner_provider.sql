DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'acme'
      AND t.typname = 'sandbox_provider'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM acme.sandboxes
      WHERE provider::text = 'hetzner'
    ) THEN
      RAISE EXCEPTION 'Cannot remove hetzner sandbox provider enum while Hetzner sandboxes still exist';
    END IF;

    ALTER TYPE acme.sandbox_provider RENAME TO sandbox_provider_old;
    CREATE TYPE acme.sandbox_provider AS ENUM ('daytona', 'local_docker', 'justavps');

    ALTER TABLE acme.sandboxes
      ALTER COLUMN provider DROP DEFAULT;

    ALTER TABLE acme.sandboxes
      ALTER COLUMN provider TYPE acme.sandbox_provider
      USING provider::text::acme.sandbox_provider;

    ALTER TABLE acme.sandboxes
      ALTER COLUMN provider SET DEFAULT 'daytona';

    ALTER TABLE acme.server_entries
      ALTER COLUMN provider TYPE acme.sandbox_provider
      USING provider::text::acme.sandbox_provider;

    ALTER TABLE acme.pool_resources
      ALTER COLUMN provider TYPE acme.sandbox_provider
      USING provider::text::acme.sandbox_provider;

    ALTER TABLE acme.pool_sandboxes
      ALTER COLUMN provider TYPE acme.sandbox_provider
      USING provider::text::acme.sandbox_provider;

    DROP TYPE acme.sandbox_provider_old;
  END IF;
END $$;
