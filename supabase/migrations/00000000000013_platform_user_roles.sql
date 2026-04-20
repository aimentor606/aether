DO $$ BEGIN
  CREATE TYPE aether.platform_role AS ENUM ('user', 'admin', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS aether.platform_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  role aether.platform_role NOT NULL DEFAULT 'user',
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'aether' AND table_name = 'platform_user_roles' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE aether.platform_user_roles RENAME COLUMN user_id TO account_id;
  END IF;
END $$;

DROP INDEX IF EXISTS aether.idx_platform_user_roles_user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_user_roles_account_id
  ON aether.platform_user_roles (account_id);
CREATE INDEX IF NOT EXISTS idx_platform_user_roles_role
  ON aether.platform_user_roles (role);

GRANT ALL ON aether.platform_user_roles TO service_role;
