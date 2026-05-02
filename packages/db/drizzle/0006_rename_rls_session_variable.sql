-- Migration: Rename RLS session variable from acme.current_account_id to aether.current_account_id
-- Part of the rebrand from acme → aether. Drops and recreates all RLS policies
-- with the updated session variable name.

-- ─── Finance Tables ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_invoices" ON "aether"."invoices";
CREATE POLICY "tenant_isolation_invoices" ON "aether"."invoices"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_expenses" ON "aether"."expenses";
CREATE POLICY "tenant_isolation_expenses" ON "aether"."expenses"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_budgets" ON "aether"."budgets";
CREATE POLICY "tenant_isolation_budgets" ON "aether"."budgets"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_ledgers" ON "aether"."ledgers";
CREATE POLICY "tenant_isolation_ledgers" ON "aether"."ledgers"
  USING (account_id::text = current_setting('aether.current_account_id', true));

-- ─── Vertical Config Tables ────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_feature_flags" ON "aether"."feature_flags";
CREATE POLICY "tenant_isolation_feature_flags" ON "aether"."feature_flags"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_vertical_configs" ON "aether"."vertical_configs";
CREATE POLICY "tenant_isolation_vertical_configs" ON "aether"."vertical_configs"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_account_integrations" ON "aether"."account_integrations";
CREATE POLICY "tenant_isolation_account_integrations" ON "aether"."account_integrations"
  USING (account_id::text = current_setting('aether.current_account_id', true));

-- ─── Insurance Tables ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_policies" ON "aether"."policies";
CREATE POLICY "tenant_isolation_policies" ON "aether"."policies"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_claims" ON "aether"."claims";
CREATE POLICY "tenant_isolation_claims" ON "aether"."claims"
  USING (account_id::text = current_setting('aether.current_account_id', true));

-- ─── Advisor Tables ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_portfolios" ON "aether"."portfolios";
CREATE POLICY "tenant_isolation_portfolios" ON "aether"."portfolios"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_risk_assessments" ON "aether"."risk_assessments";
CREATE POLICY "tenant_isolation_risk_assessments" ON "aether"."risk_assessments"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_financial_plans" ON "aether"."financial_plans";
CREATE POLICY "tenant_isolation_financial_plans" ON "aether"."financial_plans"
  USING (account_id::text = current_setting('aether.current_account_id', true));

-- ─── Shared Vertical Tables ──────────────────────────────────────────────────

DROP POLICY IF EXISTS "tenant_isolation_leads" ON "aether"."leads";
CREATE POLICY "tenant_isolation_leads" ON "aether"."leads"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_documents" ON "aether"."documents";
CREATE POLICY "tenant_isolation_documents" ON "aether"."documents"
  USING (account_id::text = current_setting('aether.current_account_id', true));

DROP POLICY IF EXISTS "tenant_isolation_compliance_records" ON "aether"."compliance_records";
CREATE POLICY "tenant_isolation_compliance_records" ON "aether"."compliance_records"
  USING (account_id::text = current_setting('aether.current_account_id', true));
