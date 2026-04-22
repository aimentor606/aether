-- Migration: Spend reconciliation state for control/data plane separation
-- Tracks per-account last known spend from LiteLLM for delta reconciliation.
-- No RLS (system-level, runs as reconciler process).

CREATE TABLE IF NOT EXISTS "acme"."spend_reconciliation_state" (
  account_id UUID PRIMARY KEY,
  last_spend_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reconciliation_updated_at
  ON "acme"."spend_reconciliation_state" (updated_at);
