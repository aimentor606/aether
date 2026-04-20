-- Rollback: Drop vertical tables
-- Reverses: 0001_vertical_tables.sql
-- WARNING: This destroys all data in these tables.

DROP TABLE IF EXISTS "acme"."account_integrations";
DROP TABLE IF EXISTS "acme"."vertical_configs";
DROP TABLE IF EXISTS "acme"."feature_flags";
DROP TABLE IF EXISTS "acme"."vertical_entities";
