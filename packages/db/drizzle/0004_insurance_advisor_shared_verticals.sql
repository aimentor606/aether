-- Insurance: policies + claims
CREATE TYPE "aether"."policy_type" AS ENUM('life', 'health', 'property', 'auto', 'travel');
CREATE TYPE "aether"."policy_status" AS ENUM('active', 'pending', 'cancelled', 'expired', 'claimed');
CREATE TABLE "aether"."policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "policy_number" varchar(50) NOT NULL,
  "type" "aether"."policy_type" NOT NULL,
  "client_id" uuid,
  "client_name" varchar(255) NOT NULL,
  "premium" numeric(12, 2) NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "status" "aether"."policy_status" DEFAULT 'pending' NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone NOT NULL,
  "coverage" jsonb DEFAULT '{}',
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_policies_account" ON "aether"."policies" ("account_id");
CREATE INDEX "idx_policies_status" ON "aether"."policies" ("status");
CREATE INDEX "idx_policies_type" ON "aether"."policies" ("type");
CREATE INDEX "idx_policies_number" ON "aether"."policies" ("policy_number", "account_id");
CREATE INDEX "idx_policies_client" ON "aether"."policies" ("client_id", "account_id");

CREATE TYPE "aether"."claim_type" AS ENUM('accident', 'illness', 'property_damage', 'theft', 'other');
CREATE TYPE "aether"."claim_status" AS ENUM('submitted', 'under_review', 'approved', 'rejected', 'paid');
CREATE TABLE "aether"."claims" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "claim_number" varchar(50) NOT NULL,
  "policy_id" uuid NOT NULL REFERENCES "aether"."policies"("id"),
  "client_id" uuid,
  "type" "aether"."claim_type" NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "status" "aether"."claim_status" DEFAULT 'submitted' NOT NULL,
  "filed_date" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_date" timestamp with time zone,
  "documents" jsonb DEFAULT '[]',
  "notes" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_claims_account" ON "aether"."claims" ("account_id");
CREATE INDEX "idx_claims_status" ON "aether"."claims" ("status");
CREATE INDEX "idx_claims_policy" ON "aether"."claims" ("policy_id", "account_id");
CREATE INDEX "idx_claims_number" ON "aether"."claims" ("claim_number", "account_id");
CREATE INDEX "idx_claims_filed_date" ON "aether"."claims" ("filed_date");

-- Advisor: portfolios + risk_assessments + financial_plans
CREATE TYPE "aether"."risk_level" AS ENUM('conservative', 'moderate', 'aggressive');
CREATE TYPE "aether"."portfolio_status" AS ENUM('active', 'frozen', 'closed');
CREATE TABLE "aether"."portfolios" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "client_id" uuid,
  "client_name" varchar(255) NOT NULL,
  "total_value" numeric(15, 2) DEFAULT '0' NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "risk_level" "aether"."risk_level" DEFAULT 'moderate' NOT NULL,
  "status" "aether"."portfolio_status" DEFAULT 'active' NOT NULL,
  "holdings" jsonb DEFAULT '[]',
  "performance" jsonb DEFAULT '{}',
  "last_rebalanced" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_portfolios_account" ON "aether"."portfolios" ("account_id");
CREATE INDEX "idx_portfolios_status" ON "aether"."portfolios" ("status");
CREATE INDEX "idx_portfolios_risk" ON "aether"."portfolios" ("risk_level");
CREATE INDEX "idx_portfolios_client" ON "aether"."portfolios" ("client_id", "account_id");

CREATE TYPE "aether"."risk_category" AS ENUM('conservative', 'moderately_conservative', 'moderate', 'moderately_aggressive', 'aggressive');
CREATE TABLE "aether"."risk_assessments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "client_id" uuid,
  "client_name" varchar(255) NOT NULL,
  "risk_score" integer NOT NULL,
  "risk_category" "aether"."risk_category" NOT NULL,
  "answers" jsonb DEFAULT '[]',
  "assessed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_risk_assessments_account" ON "aether"."risk_assessments" ("account_id");
CREATE INDEX "idx_risk_assessments_category" ON "aether"."risk_assessments" ("risk_category");
CREATE INDEX "idx_risk_assessments_client" ON "aether"."risk_assessments" ("client_id", "account_id");
CREATE INDEX "idx_risk_assessments_expires" ON "aether"."risk_assessments" ("expires_at");

CREATE TYPE "aether"."plan_type" AS ENUM('retirement', 'education', 'wealth_preservation', 'growth');
CREATE TYPE "aether"."plan_status" AS ENUM('draft', 'active', 'completed', 'archived');
CREATE TABLE "aether"."financial_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "client_id" uuid,
  "client_name" varchar(255) NOT NULL,
  "plan_type" "aether"."plan_type" NOT NULL,
  "goal_amount" numeric(15, 2) NOT NULL,
  "current_progress" numeric(5, 2) DEFAULT '0' NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "timeline" varchar(100),
  "milestones" jsonb DEFAULT '[]',
  "status" "aether"."plan_status" DEFAULT 'draft' NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_financial_plans_account" ON "aether"."financial_plans" ("account_id");
CREATE INDEX "idx_financial_plans_status" ON "aether"."financial_plans" ("status");
CREATE INDEX "idx_financial_plans_type" ON "aether"."financial_plans" ("plan_type");
CREATE INDEX "idx_financial_plans_client" ON "aether"."financial_plans" ("client_id", "account_id");

-- Shared: leads + documents + compliance_records
CREATE TYPE "aether"."lead_source" AS ENUM('website', 'referral', 'social_media', 'cold_call', 'event', 'advertisement', 'other');
CREATE TYPE "aether"."lead_vertical" AS ENUM('insurance', 'advisor', 'both');
CREATE TYPE "aether"."lead_status" AS ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'archived');
CREATE TABLE "aether"."leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "email" varchar(255),
  "phone" varchar(50),
  "company" varchar(255),
  "source" "aether"."lead_source" DEFAULT 'other',
  "vertical" "aether"."lead_vertical" DEFAULT 'both' NOT NULL,
  "status" "aether"."lead_status" DEFAULT 'new' NOT NULL,
  "notes" text,
  "assigned_to" uuid,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_leads_account" ON "aether"."leads" ("account_id");
CREATE INDEX "idx_leads_status" ON "aether"."leads" ("status");
CREATE INDEX "idx_leads_vertical" ON "aether"."leads" ("vertical");
CREATE INDEX "idx_leads_assigned" ON "aether"."leads" ("assigned_to", "account_id");

CREATE TYPE "aether"."document_status" AS ENUM('pending', 'uploaded', 'verified', 'rejected', 'expired');
CREATE TABLE "aether"."documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "name" varchar(255) NOT NULL,
  "document_type" varchar(100) NOT NULL,
  "status" "aether"."document_status" DEFAULT 'pending' NOT NULL,
  "file_url" text,
  "uploaded_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_documents_account" ON "aether"."documents" ("account_id");
CREATE INDEX "idx_documents_entity" ON "aether"."documents" ("entity_type", "entity_id");
CREATE INDEX "idx_documents_status" ON "aether"."documents" ("status");

CREATE TYPE "aether"."compliance_check_type" AS ENUM('kyc', 'aml', 'risk_disclosure', 'regulatory');
CREATE TYPE "aether"."compliance_status" AS ENUM('pending', 'passed', 'failed', 'expired', 'waived');
CREATE TABLE "aether"."compliance_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL,
  "entity_type" varchar(50) NOT NULL,
  "entity_id" uuid NOT NULL,
  "check_type" "aether"."compliance_check_type" NOT NULL,
  "status" "aether"."compliance_status" DEFAULT 'pending' NOT NULL,
  "checked_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "notes" text,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "idx_compliance_account" ON "aether"."compliance_records" ("account_id");
CREATE INDEX "idx_compliance_entity" ON "aether"."compliance_records" ("entity_type", "entity_id");
CREATE INDEX "idx_compliance_status" ON "aether"."compliance_records" ("status");
CREATE INDEX "idx_compliance_expires" ON "aether"."compliance_records" ("expires_at");
