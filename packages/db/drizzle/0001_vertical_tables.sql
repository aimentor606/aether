CREATE TABLE "acme"."vertical_entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(100) NOT NULL,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_vertical_entities_type" ON "acme"."vertical_entities" ("type");
--> statement-breakpoint
CREATE INDEX "idx_vertical_entities_name" ON "acme"."vertical_entities" ("name");
--> statement-breakpoint
CREATE TABLE "acme"."feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"vertical_id" varchar(100) NOT NULL,
	"feature_name" varchar(255) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_feature_flags_account" ON "acme"."feature_flags" ("account_id");
--> statement-breakpoint
CREATE INDEX "idx_feature_flags_vertical" ON "acme"."feature_flags" ("vertical_id");
--> statement-breakpoint
CREATE INDEX "idx_feature_flags_name" ON "acme"."feature_flags" ("feature_name");
--> statement-breakpoint
CREATE TABLE "acme"."vertical_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"vertical_id" varchar(100) NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_vertical_configs_account" ON "acme"."vertical_configs" ("account_id");
--> statement-breakpoint
CREATE INDEX "idx_vertical_configs_vertical" ON "acme"."vertical_configs" ("vertical_id");
--> statement-breakpoint
CREATE TABLE "acme"."account_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"integration_type" varchar(100) NOT NULL,
	"credentials" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_account_integrations_account" ON "acme"."account_integrations" ("account_id");
--> statement-breakpoint
CREATE INDEX "idx_account_integrations_type" ON "acme"."account_integrations" ("integration_type");
