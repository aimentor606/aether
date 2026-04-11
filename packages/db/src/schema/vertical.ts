import {
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
  boolean,
} from 'drizzle-orm/pg-core';
import { acmeSchema } from './kortix';

export const verticalTables = acmeSchema.table('vertical_entities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_vertical_entities_type').on(table.type),
  index('idx_vertical_entities_name').on(table.name),
]);

export const featureFlags = acmeSchema.table('feature_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  verticalId: varchar('vertical_id', { length: 100 }).notNull(),
  featureName: varchar('feature_name', { length: 255 }).notNull(),
  enabled: boolean('enabled').notNull().default(false),
  config: jsonb('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_feature_flags_account').on(table.accountId),
  index('idx_feature_flags_vertical').on(table.verticalId),
  index('idx_feature_flags_name').on(table.featureName),
]);

export const verticalConfigs = acmeSchema.table('vertical_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  verticalId: varchar('vertical_id', { length: 100 }).notNull(),
  config: jsonb('config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_vertical_configs_account').on(table.accountId),
  index('idx_vertical_configs_vertical').on(table.verticalId),
]);

export const accountIntegrations = acmeSchema.table('account_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  integrationType: varchar('integration_type', { length: 100 }).notNull(),
  credentials: jsonb('credentials').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_account_integrations_account').on(table.accountId),
  index('idx_account_integrations_type').on(table.integrationType),
]);
