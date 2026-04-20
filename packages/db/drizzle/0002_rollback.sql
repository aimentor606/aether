-- Rollback: Disable Row Level Security on vertical and finance tables
-- Reverses: 0002_enable_rls_vertical_tables.sql

-- ─── Finance Tables ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_ledgers" ON "acme"."ledgers";
ALTER TABLE "acme"."ledgers" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_budgets" ON "acme"."budgets";
ALTER TABLE "acme"."budgets" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_expenses" ON "acme"."expenses";
ALTER TABLE "acme"."expenses" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_invoices" ON "acme"."invoices";
ALTER TABLE "acme"."invoices" DISABLE ROW LEVEL SECURITY;

-- ─── Vertical Tables ──────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_account_integrations" ON "acme"."account_integrations";
ALTER TABLE "acme"."account_integrations" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_vertical_configs" ON "acme"."vertical_configs";
ALTER TABLE "acme"."vertical_configs" DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_feature_flags" ON "acme"."feature_flags";
ALTER TABLE "acme"."feature_flags" DISABLE ROW LEVEL SECURITY;
