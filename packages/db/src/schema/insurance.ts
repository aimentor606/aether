import { uuid, varchar, text, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { aetherSchema, accounts } from './aether';
import { z } from 'zod';

// ============================================================================
// POLICIES (保单)
// ============================================================================

export const policyTypeEnum = aetherSchema.enum('policy_type', [
  'life',
  'health',
  'property',
  'auto',
  'travel',
]);

export const policyStatusEnum = aetherSchema.enum('policy_status', [
  'active',
  'pending',
  'cancelled',
  'expired',
  'claimed',
]);

export const policies = aetherSchema.table(
  'policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    policyNumber: varchar('policy_number', { length: 50 }).notNull(),
    type: policyTypeEnum('type').notNull(),
    clientId: uuid('client_id'),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    premium: numeric('premium', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    status: policyStatusEnum('status').default('pending').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    coverage: jsonb('coverage').default({}).$type<Record<string, unknown>>(),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_policies_account').on(table.accountId),
    index('idx_policies_status').on(table.status),
    index('idx_policies_type').on(table.type),
    index('idx_policies_number').on(table.policyNumber, table.accountId),
    index('idx_policies_client').on(table.clientId, table.accountId),
  ],
);

export const policiesRelations = relations(policies, ({ one }) => ({
  account: one(accounts, {
    fields: [policies.accountId],
    references: [accounts.accountId],
  }),
}));

export const createPolicySchema = z.object({
  policyNumber: z.string().min(1).max(50),
  type: z.enum(['life', 'health', 'property', 'auto', 'travel']),
  clientName: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  premium: z.string().or(z.number()),
  currency: z.string().length(3).default('USD'),
  status: z.enum(['active', 'pending', 'cancelled', 'expired', 'claimed']).optional(),
  startDate: z.date().or(z.string()),
  endDate: z.date().or(z.string()),
  coverage: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updatePolicySchema = createPolicySchema.partial();

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;

// ============================================================================
// CLAIMS (理赔)
// ============================================================================

export const claimTypeEnum = aetherSchema.enum('claim_type', [
  'accident',
  'illness',
  'property_damage',
  'theft',
  'other',
]);

export const claimStatusEnum = aetherSchema.enum('claim_status', [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'paid',
]);

export const claims = aetherSchema.table(
  'claims',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    claimNumber: varchar('claim_number', { length: 50 }).notNull(),
    policyId: uuid('policy_id').notNull(),
    clientId: uuid('client_id'),
    type: claimTypeEnum('type').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    status: claimStatusEnum('status').default('submitted').notNull(),
    filedDate: timestamp('filed_date', { withTimezone: true }).defaultNow().notNull(),
    resolvedDate: timestamp('resolved_date', { withTimezone: true }),
    documents: jsonb('documents').default([]).$type<ClaimDocument[]>(),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_claims_account').on(table.accountId),
    index('idx_claims_status').on(table.status),
    index('idx_claims_policy').on(table.policyId, table.accountId),
    index('idx_claims_number').on(table.claimNumber, table.accountId),
    index('idx_claims_filed_date').on(table.filedDate),
  ],
);

export const claimsRelations = relations(claims, ({ one }) => ({
  account: one(accounts, {
    fields: [claims.accountId],
    references: [accounts.accountId],
  }),
  policy: one(policies, {
    fields: [claims.policyId],
    references: [policies.id],
  }),
}));

export interface ClaimDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: string;
}

export const claimDocumentSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  name: z.string().min(1),
  url: z.string().min(1),
  uploadedAt: z.string().datetime(),
});

export const createClaimSchema = z.object({
  claimNumber: z.string().min(1).max(50),
  policyId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  type: z.enum(['accident', 'illness', 'property_damage', 'theft', 'other']),
  amount: z.string().or(z.number()),
  currency: z.string().length(3).default('USD'),
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'paid']).optional(),
  filedDate: z.date().or(z.string()).optional(),
  documents: z.array(claimDocumentSchema).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateClaimSchema = createClaimSchema.partial();

export type CreateClaimInput = z.infer<typeof createClaimSchema>;
export type UpdateClaimInput = z.infer<typeof updateClaimSchema>;
