-- Migration: Enable Row Level Security on vertical and finance tables
-- All tables in acme schema that contain account_id must be tenant-isolated.
-- RLS policies ensure that queries are scoped to the requesting account even
-- if the application layer fails to filter.
--
-- The application sets acme.current_account_id per transaction via
-- SET LOCAL acme.current_account_id = '<uuid>' inside a BEGIN/COMMIT block.
-- If not set, the policies default to denying all rows.

-- ─── Vertical Tables ──────────────────────────────────────────────────────────

ALTER TABLE "acme"."feature_flags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_feature_flags" ON "acme"."feature_flags"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "acme"."vertical_configs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_vertical_configs" ON "acme"."vertical_configs"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "acme"."account_integrations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_account_integrations" ON "acme"."account_integrations"
  USING (account_id::text = current_setting('acme.current_account_id', true));

-- ─── Finance Tables ───────────────────────────────────────────────────────────

--> statement-breakpoint
ALTER TABLE "acme"."invoices" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_invoices" ON "acme"."invoices"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "acme"."expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_expenses" ON "acme"."expenses"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "acme"."budgets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_budgets" ON "acme"."budgets"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "acme"."ledgers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_ledgers" ON "acme"."ledgers"
  USING (account_id::text = current_setting('acme.current_account_id', true));
