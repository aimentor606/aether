-- Migration: Enable Row Level Security on insurance, advisor, and shared-vertical tables
-- These 9 tables were created in 0004 but lack RLS policies.
-- Same pattern as 0002_enable_rls_vertical_tables.sql.
--
-- The application sets acme.current_account_id per transaction via
-- SET LOCAL acme.current_account_id = '<uuid>' inside a BEGIN/COMMIT block.

-- ─── Insurance Tables ─────────────────────────────────────────────────────────

ALTER TABLE "aether"."policies" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policies" ON "aether"."policies"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "aether"."claims" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_claims" ON "aether"."claims"
  USING (account_id::text = current_setting('acme.current_account_id', true));

-- ─── Advisor Tables ───────────────────────────────────────────────────────────

--> statement-breakpoint
ALTER TABLE "aether"."portfolios" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_portfolios" ON "aether"."portfolios"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "aether"."risk_assessments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_risk_assessments" ON "aether"."risk_assessments"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "aether"."financial_plans" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_financial_plans" ON "aether"."financial_plans"
  USING (account_id::text = current_setting('acme.current_account_id', true));

-- ─── Shared Vertical Tables ──────────────────────────────────────────────────

--> statement-breakpoint
ALTER TABLE "aether"."leads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_leads" ON "aether"."leads"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "aether"."documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_documents" ON "aether"."documents"
  USING (account_id::text = current_setting('acme.current_account_id', true));

--> statement-breakpoint
ALTER TABLE "aether"."compliance_records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_compliance_records" ON "aether"."compliance_records"
  USING (account_id::text = current_setting('acme.current_account_id', true));
