-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  Bootstrap Migration                                                       ║
-- ║                                                                             ║
-- ║  Creates schemas, enables extensions, and installs helper functions         ║
-- ║  that Drizzle ORM cannot manage (it only handles tables/indexes/enums).    ║
-- ║                                                                             ║
-- ║  After this migration runs, `drizzle-kit push` creates the actual tables.  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ─── Schemas ─────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS aether;
CREATE SCHEMA IF NOT EXISTS basejump;

-- ─── Schema Permissions ─────────────────────────────────────────────────────
-- Supabase PostgREST requires USAGE on a schema before it can query tables
-- in that schema via .schema('aether'). Without this, queries silently return
-- null even if table-level SELECT is granted.
GRANT USAGE ON SCHEMA aether TO anon;
GRANT USAGE ON SCHEMA aether TO authenticated;
GRANT USAGE ON SCHEMA aether TO service_role;

-- ─── Drizzle-managed tables (aether.* schema) ────────────────────────────
-- These tables are normally created by 'drizzle-kit push' but must exist
-- before subsequent ALTER migrations can run.


CREATE TYPE "aether"."access_request_status" AS ENUM('pending', 'approved', 'rejected');
CREATE TYPE "aether"."account_role" AS ENUM('owner', 'admin', 'member');
CREATE TYPE "aether"."api_key_status" AS ENUM('active', 'revoked', 'expired');
CREATE TYPE "aether"."api_key_type" AS ENUM('user', 'sandbox');
CREATE TYPE "aether"."deployment_source" AS ENUM('git', 'code', 'files', 'tar');
CREATE TYPE "aether"."deployment_status" AS ENUM('pending', 'building', 'deploying', 'active', 'failed', 'stopped');
CREATE TYPE "aether"."integration_status" AS ENUM('active', 'revoked', 'expired', 'error');
CREATE TYPE "aether"."platform_role" AS ENUM('user', 'admin', 'super_admin');
CREATE TYPE "aether"."sandbox_provider" AS ENUM('daytona', 'local_docker', 'justavps');
CREATE TYPE "aether"."sandbox_status" AS ENUM('provisioning', 'active', 'stopped', 'archived', 'pooled', 'error');
CREATE TYPE "aether"."tunnel_capability" AS ENUM('filesystem', 'shell', 'network', 'apps', 'hardware', 'desktop', 'gpu');
CREATE TYPE "aether"."tunnel_permission_request_status" AS ENUM('pending', 'approved', 'denied', 'expired');
CREATE TYPE "aether"."tunnel_permission_status" AS ENUM('active', 'revoked', 'expired');
CREATE TYPE "aether"."tunnel_status" AS ENUM('online', 'offline', 'connecting');
CREATE TABLE "aether"."access_allowlist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_type" varchar(20) NOT NULL,
	"value" varchar(255) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."access_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"company" varchar(255),
	"use_case" text,
	"status" "aether"."access_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."account_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now(),
	"scheduled_for" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone
);

CREATE TABLE "aether"."account_members" (
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"account_role" "aether"."account_role" DEFAULT 'owner' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."accounts" (
	"account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"personal_account" boolean DEFAULT true NOT NULL,
	"setup_complete_at" timestamp with time zone,
	"setup_wizard_step" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."billing_customers" (
	"account_id" uuid NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"active" boolean,
	"provider" text
);

CREATE TABLE "aether"."credit_accounts" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"balance" numeric(12, 4) DEFAULT '0' NOT NULL,
	"lifetime_granted" numeric(12, 4) DEFAULT '0' NOT NULL,
	"lifetime_purchased" numeric(12, 4) DEFAULT '0' NOT NULL,
	"lifetime_used" numeric(12, 4) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"last_grant_date" timestamp with time zone,
	"tier" varchar(50) DEFAULT 'free',
	"billing_cycle_anchor" timestamp with time zone,
	"next_credit_grant" timestamp with time zone,
	"stripe_subscription_id" varchar(255),
	"expiring_credits" numeric(12, 4) DEFAULT '0' NOT NULL,
	"non_expiring_credits" numeric(12, 4) DEFAULT '0' NOT NULL,
	"daily_credits_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"trial_status" varchar(20) DEFAULT 'none',
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"is_grandfathered_free" boolean DEFAULT false,
	"last_processed_invoice_id" varchar(255),
	"commitment_type" varchar(50),
	"commitment_start_date" timestamp with time zone,
	"commitment_end_date" timestamp with time zone,
	"commitment_price_id" varchar(255),
	"can_cancel_after" timestamp with time zone,
	"last_renewal_period_start" bigint,
	"payment_status" text DEFAULT 'active',
	"last_payment_failure" timestamp with time zone,
	"scheduled_tier_change" text,
	"scheduled_tier_change_date" timestamp with time zone,
	"scheduled_price_id" text,
	"provider" varchar(20) DEFAULT 'stripe',
	"revenuecat_customer_id" varchar(255),
	"revenuecat_subscription_id" varchar(255),
	"revenuecat_cancelled_at" timestamp with time zone,
	"revenuecat_cancel_at_period_end" timestamp with time zone,
	"revenuecat_pending_change_product" text,
	"revenuecat_pending_change_date" timestamp with time zone,
	"revenuecat_pending_change_type" text,
	"revenuecat_product_id" text,
	"plan_type" varchar(50) DEFAULT 'monthly',
	"stripe_subscription_status" varchar(50),
	"last_daily_refresh" timestamp with time zone,
	"auto_topup_enabled" boolean DEFAULT true NOT NULL,
	"auto_topup_threshold" numeric(10, 2) DEFAULT '5' NOT NULL,
	"auto_topup_amount" numeric(10, 2) DEFAULT '20' NOT NULL,
	"auto_topup_last_charged" timestamp with time zone
);

CREATE TABLE "aether"."credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"amount" numeric(12, 4) NOT NULL,
	"balance_after" numeric(12, 4) NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"reference_id" uuid,
	"reference_type" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"created_by" uuid,
	"is_expiring" boolean DEFAULT true,
	"expires_at" timestamp with time zone,
	"stripe_event_id" varchar(255),
	"idempotency_key" text,
	"processing_source" text,
	CONSTRAINT "aether_unique_stripe_event" UNIQUE("stripe_event_id")
);

CREATE TABLE "aether"."credit_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"amount_dollars" numeric(10, 2) NOT NULL,
	"stripe_payment_intent_id" text,
	"stripe_charge_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"provider" varchar(50) DEFAULT 'stripe',
	"revenuecat_transaction_id" varchar(255),
	"revenuecat_product_id" varchar(255)
);

CREATE TABLE "aether"."credit_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"amount_dollars" numeric(10, 2) NOT NULL,
	"description" text,
	"usage_type" text DEFAULT 'token_overage',
	"created_at" timestamp with time zone DEFAULT now(),
	"subscription_tier" text,
	"metadata" jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE "aether"."deployments" (
	"deployment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"sandbox_id" uuid,
	"freestyle_id" text,
	"status" "aether"."deployment_status" DEFAULT 'pending' NOT NULL,
	"source_type" "aether"."deployment_source" NOT NULL,
	"source_ref" text,
	"framework" varchar(50),
	"domains" jsonb DEFAULT '[]'::jsonb,
	"live_url" text,
	"env_vars" jsonb DEFAULT '{}'::jsonb,
	"build_config" jsonb,
	"entrypoint" text,
	"error" text,
	"version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."integrations" (
	"integration_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"app" varchar(255) NOT NULL,
	"app_name" varchar(255),
	"provider_name" varchar(50) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"label" varchar(255),
	"status" "aether"."integration_status" DEFAULT 'active' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."api_keys" (
	"key_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"public_key" varchar(64) NOT NULL,
	"secret_key_hash" varchar(128) NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"type" "aether"."api_key_type" DEFAULT 'user' NOT NULL,
	"status" "aether"."api_key_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."oauth_access_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."oauth_authorization_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(128) NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"redirect_uri" text NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"code_challenge" text NOT NULL,
	"code_challenge_method" varchar(10) DEFAULT 'S256' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."oauth_clients" (
	"client_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_secret_hash" varchar(128) NOT NULL,
	"name" varchar(255) NOT NULL,
	"redirect_uris" jsonb DEFAULT '[]'::jsonb,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."oauth_refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"access_token_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."platform_settings" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."platform_user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"role" "aether"."platform_role" DEFAULT 'user' NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."pool_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "aether"."sandbox_provider" NOT NULL,
	"server_type" varchar(64) NOT NULL,
	"location" varchar(64) NOT NULL,
	"desired_count" integer DEFAULT 2 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."pool_sandboxes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid,
	"provider" "aether"."sandbox_provider" NOT NULL,
	"external_id" text NOT NULL,
	"base_url" text DEFAULT '' NOT NULL,
	"server_type" varchar(64) NOT NULL,
	"location" varchar(64) NOT NULL,
	"status" varchar(32) DEFAULT 'provisioning' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone
);

CREATE TABLE "aether"."sandbox_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sandbox_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."sandboxes" (
	"sandbox_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" "aether"."sandbox_provider" DEFAULT 'daytona' NOT NULL,
	"external_id" text,
	"status" "aether"."sandbox_status" DEFAULT 'provisioning' NOT NULL,
	"base_url" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_included" boolean DEFAULT false NOT NULL,
	"stripe_subscription_item_id" text
);

CREATE TABLE "aether"."server_entries" (
	"entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id" varchar(128) NOT NULL,
	"account_id" uuid,
	"label" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"provider" "aether"."sandbox_provider",
	"sandbox_id" text,
	"mapped_ports" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."tunnel_audit_logs" (
	"log_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tunnel_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"capability" "aether"."tunnel_capability" NOT NULL,
	"operation" varchar(100) NOT NULL,
	"request_summary" jsonb DEFAULT '{}'::jsonb,
	"success" boolean NOT NULL,
	"duration_ms" integer,
	"bytes_transferred" integer,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."tunnel_connections" (
	"tunnel_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"sandbox_id" uuid,
	"name" varchar(255) NOT NULL,
	"status" "aether"."tunnel_status" DEFAULT 'offline' NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb,
	"machine_info" jsonb DEFAULT '{}'::jsonb,
	"setup_token_hash" varchar(128),
	"last_heartbeat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."tunnel_permission_requests" (
	"request_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tunnel_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"capability" "aether"."tunnel_capability" NOT NULL,
	"requested_scope" jsonb DEFAULT '{}'::jsonb,
	"reason" text,
	"status" "aether"."tunnel_permission_request_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "aether"."tunnel_permissions" (
	"permission_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tunnel_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"capability" "aether"."tunnel_capability" NOT NULL,
	"scope" jsonb DEFAULT '{}'::jsonb,
	"status" "aether"."tunnel_permission_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "aether"."account_members" ADD CONSTRAINT "account_members_account_id_accounts_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "aether"."accounts"("account_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."deployments" ADD CONSTRAINT "deployments_sandbox_id_sandboxes_sandbox_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "aether"."sandboxes"("sandbox_id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aether"."api_keys" ADD CONSTRAINT "api_keys_sandbox_id_sandboxes_sandbox_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "aether"."sandboxes"("sandbox_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."oauth_access_tokens" ADD CONSTRAINT "oauth_access_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "aether"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."oauth_authorization_codes" ADD CONSTRAINT "oauth_authorization_codes_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "aether"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_access_token_id_oauth_access_tokens_id_fk" FOREIGN KEY ("access_token_id") REFERENCES "aether"."oauth_access_tokens"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."oauth_refresh_tokens" ADD CONSTRAINT "oauth_refresh_tokens_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "aether"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."pool_sandboxes" ADD CONSTRAINT "pool_sandboxes_resource_id_pool_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "aether"."pool_resources"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aether"."sandbox_integrations" ADD CONSTRAINT "sandbox_integrations_sandbox_id_sandboxes_sandbox_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "aether"."sandboxes"("sandbox_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."sandbox_integrations" ADD CONSTRAINT "sandbox_integrations_integration_id_integrations_integration_id_fk" FOREIGN KEY ("integration_id") REFERENCES "aether"."integrations"("integration_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."tunnel_audit_logs" ADD CONSTRAINT "tunnel_audit_logs_tunnel_id_tunnel_connections_tunnel_id_fk" FOREIGN KEY ("tunnel_id") REFERENCES "aether"."tunnel_connections"("tunnel_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."tunnel_connections" ADD CONSTRAINT "tunnel_connections_sandbox_id_sandboxes_sandbox_id_fk" FOREIGN KEY ("sandbox_id") REFERENCES "aether"."sandboxes"("sandbox_id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "aether"."tunnel_permission_requests" ADD CONSTRAINT "tunnel_permission_requests_tunnel_id_tunnel_connections_tunnel_id_fk" FOREIGN KEY ("tunnel_id") REFERENCES "aether"."tunnel_connections"("tunnel_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "aether"."tunnel_permissions" ADD CONSTRAINT "tunnel_permissions_tunnel_id_tunnel_connections_tunnel_id_fk" FOREIGN KEY ("tunnel_id") REFERENCES "aether"."tunnel_connections"("tunnel_id") ON DELETE cascade ON UPDATE no action;
CREATE UNIQUE INDEX "idx_access_allowlist_type_value" ON "aether"."access_allowlist" USING btree ("entry_type","value");
CREATE INDEX "idx_access_requests_email" ON "aether"."access_requests" USING btree ("email");
CREATE INDEX "idx_access_requests_status" ON "aether"."access_requests" USING btree ("status");
CREATE INDEX "idx_account_members_user_id" ON "aether"."account_members" USING btree ("user_id");
CREATE INDEX "idx_account_members_account_id" ON "aether"."account_members" USING btree ("account_id");
CREATE UNIQUE INDEX "idx_account_members_user_account" ON "aether"."account_members" USING btree ("user_id","account_id");
CREATE INDEX "idx_aether_billing_customers_account_id" ON "aether"."billing_customers" USING btree ("account_id");
CREATE INDEX "aether_credit_accounts_account_id_idx" ON "aether"."credit_accounts" USING btree ("account_id");
CREATE INDEX "idx_aether_credit_ledger_idempotency" ON "aether"."credit_ledger" USING btree ("idempotency_key") WHERE "aether"."credit_ledger"."idempotency_key" IS NOT NULL;
CREATE INDEX "idx_deployments_account" ON "aether"."deployments" USING btree ("account_id");
CREATE INDEX "idx_deployments_sandbox" ON "aether"."deployments" USING btree ("sandbox_id");
CREATE INDEX "idx_deployments_status" ON "aether"."deployments" USING btree ("status");
CREATE INDEX "idx_deployments_live_url" ON "aether"."deployments" USING btree ("live_url");
CREATE INDEX "idx_deployments_created" ON "aether"."deployments" USING btree ("created_at");
CREATE INDEX "idx_integrations_account" ON "aether"."integrations" USING btree ("account_id");
CREATE INDEX "idx_integrations_app" ON "aether"."integrations" USING btree ("app");
CREATE INDEX "idx_integrations_provider_account" ON "aether"."integrations" USING btree ("provider_account_id");
CREATE UNIQUE INDEX "idx_integrations_account_provider_account" ON "aether"."integrations" USING btree ("account_id","provider_account_id");
CREATE UNIQUE INDEX "idx_aether_api_keys_public_key" ON "aether"."api_keys" USING btree ("public_key");
CREATE INDEX "idx_aether_api_keys_secret_hash" ON "aether"."api_keys" USING btree ("secret_key_hash");
CREATE INDEX "idx_aether_api_keys_sandbox" ON "aether"."api_keys" USING btree ("sandbox_id");
CREATE INDEX "idx_aether_api_keys_account" ON "aether"."api_keys" USING btree ("account_id");
CREATE UNIQUE INDEX "idx_oauth_access_token_hash" ON "aether"."oauth_access_tokens" USING btree ("token_hash");
CREATE INDEX "idx_oauth_access_tokens_client" ON "aether"."oauth_access_tokens" USING btree ("client_id");
CREATE INDEX "idx_oauth_access_tokens_user" ON "aether"."oauth_access_tokens" USING btree ("user_id");
CREATE UNIQUE INDEX "idx_oauth_codes_code" ON "aether"."oauth_authorization_codes" USING btree ("code");
CREATE INDEX "idx_oauth_codes_client" ON "aether"."oauth_authorization_codes" USING btree ("client_id");
CREATE INDEX "idx_oauth_codes_expires" ON "aether"."oauth_authorization_codes" USING btree ("expires_at");
CREATE UNIQUE INDEX "idx_oauth_refresh_token_hash" ON "aether"."oauth_refresh_tokens" USING btree ("token_hash");
CREATE INDEX "idx_oauth_refresh_tokens_client" ON "aether"."oauth_refresh_tokens" USING btree ("client_id");
CREATE UNIQUE INDEX "idx_platform_user_roles_account_id" ON "aether"."platform_user_roles" USING btree ("account_id");
CREATE INDEX "idx_platform_user_roles_role" ON "aether"."platform_user_roles" USING btree ("role");
CREATE UNIQUE INDEX "idx_pool_resources_unique" ON "aether"."pool_resources" USING btree ("provider","server_type","location");
CREATE INDEX "idx_pool_sandboxes_claim" ON "aether"."pool_sandboxes" USING btree ("status","created_at");
CREATE UNIQUE INDEX "idx_pool_sandboxes_external_id_active" ON "aether"."pool_sandboxes" USING btree ("external_id");
CREATE UNIQUE INDEX "idx_sandbox_integration_unique" ON "aether"."sandbox_integrations" USING btree ("sandbox_id","integration_id");
CREATE INDEX "idx_sandbox_integrations_sandbox" ON "aether"."sandbox_integrations" USING btree ("sandbox_id");
CREATE INDEX "idx_sandboxes_account" ON "aether"."sandboxes" USING btree ("account_id");
CREATE INDEX "idx_sandboxes_external_id" ON "aether"."sandboxes" USING btree ("external_id");
CREATE INDEX "idx_sandboxes_status" ON "aether"."sandboxes" USING btree ("status");
CREATE INDEX "idx_server_entries_default" ON "aether"."server_entries" USING btree ("is_default");
CREATE INDEX "idx_server_entries_account" ON "aether"."server_entries" USING btree ("account_id");
CREATE UNIQUE INDEX "idx_server_entries_account_id" ON "aether"."server_entries" USING btree ("account_id","id");
CREATE INDEX "idx_tunnel_audit_tunnel" ON "aether"."tunnel_audit_logs" USING btree ("tunnel_id");
CREATE INDEX "idx_tunnel_audit_account" ON "aether"."tunnel_audit_logs" USING btree ("account_id");
CREATE INDEX "idx_tunnel_audit_capability" ON "aether"."tunnel_audit_logs" USING btree ("capability");
CREATE INDEX "idx_tunnel_audit_created" ON "aether"."tunnel_audit_logs" USING btree ("created_at");
CREATE INDEX "idx_tunnel_connections_account" ON "aether"."tunnel_connections" USING btree ("account_id");
CREATE INDEX "idx_tunnel_connections_sandbox" ON "aether"."tunnel_connections" USING btree ("sandbox_id");
CREATE INDEX "idx_tunnel_connections_status" ON "aether"."tunnel_connections" USING btree ("status");
CREATE INDEX "idx_tunnel_perm_requests_tunnel" ON "aether"."tunnel_permission_requests" USING btree ("tunnel_id");
CREATE INDEX "idx_tunnel_perm_requests_account" ON "aether"."tunnel_permission_requests" USING btree ("account_id");
CREATE INDEX "idx_tunnel_perm_requests_status" ON "aether"."tunnel_permission_requests" USING btree ("status");
CREATE INDEX "idx_tunnel_permissions_tunnel" ON "aether"."tunnel_permissions" USING btree ("tunnel_id");
CREATE INDEX "idx_tunnel_permissions_account" ON "aether"."tunnel_permissions" USING btree ("account_id");
CREATE INDEX "idx_tunnel_permissions_capability" ON "aether"."tunnel_permissions" USING btree ("capability");
CREATE INDEX "idx_tunnel_permissions_status" ON "aether"."tunnel_permissions" USING btree ("status");
