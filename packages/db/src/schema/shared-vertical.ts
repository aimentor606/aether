import { uuid, varchar, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { aetherSchema, accounts } from './aether';
import { z } from 'zod';

// ============================================================================
// LEADS (shared by insurance + advisor)
// ============================================================================

export const leadSourceEnum = aetherSchema.enum('lead_source', [
  'website',
  'referral',
  'social_media',
  'cold_call',
  'event',
  'advertisement',
  'other',
]);

export const leadVerticalEnum = aetherSchema.enum('lead_vertical', [
  'insurance',
  'advisor',
  'both',
]);

export const leadStatusEnum = aetherSchema.enum('lead_status', [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
  'archived',
]);

export const leads = aetherSchema.table(
  'leads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    company: varchar('company', { length: 255 }),
    source: leadSourceEnum('source').default('other'),
    vertical: leadVerticalEnum('vertical').default('both').notNull(),
    status: leadStatusEnum('status').default('new').notNull(),
    notes: text('notes'),
    assignedTo: uuid('assigned_to'),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_leads_account').on(table.accountId),
    index('idx_leads_status').on(table.status),
    index('idx_leads_vertical').on(table.vertical),
    index('idx_leads_assigned').on(table.assignedTo, table.accountId),
  ],
);

export const leadsRelations = relations(leads, ({ one }) => ({
  account: one(accounts, {
    fields: [leads.accountId],
    references: [accounts.accountId],
  }),
}));

export const createLeadSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  source: z.enum(['website', 'referral', 'social_media', 'cold_call', 'event', 'advertisement', 'other']).optional(),
  vertical: z.enum(['insurance', 'advisor', 'both']).default('both'),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost', 'archived']).optional(),
  notes: z.string().optional(),
  assignedTo: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

// ============================================================================
// DOCUMENTS (shared by insurance + advisor)
// ============================================================================

export const documentStatusEnum = aetherSchema.enum('document_status', [
  'pending',
  'uploaded',
  'verified',
  'rejected',
  'expired',
]);

export const documents = aetherSchema.table(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    documentType: varchar('document_type', { length: 100 }).notNull(),
    status: documentStatusEnum('status').default('pending').notNull(),
    fileUrl: text('file_url'),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_documents_account').on(table.accountId),
    index('idx_documents_entity').on(table.entityType, table.entityId),
    index('idx_documents_status').on(table.status),
  ],
);

export const documentsRelations = relations(documents, ({ one }) => ({
  account: one(accounts, {
    fields: [documents.accountId],
    references: [accounts.accountId],
  }),
}));

export const createDocumentSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  documentType: z.string().min(1).max(100),
  status: z.enum(['pending', 'uploaded', 'verified', 'rejected', 'expired']).optional(),
  fileUrl: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateDocumentSchema = createDocumentSchema.partial();

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

// ============================================================================
// COMPLIANCE RECORDS (shared by insurance + advisor)
// ============================================================================

export const complianceCheckTypeEnum = aetherSchema.enum('compliance_check_type', [
  'kyc',
  'aml',
  'risk_disclosure',
  'regulatory',
]);

export const complianceStatusEnum = aetherSchema.enum('compliance_status', [
  'pending',
  'passed',
  'failed',
  'expired',
  'waived',
]);

export const complianceRecords = aetherSchema.table(
  'compliance_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    checkType: complianceCheckTypeEnum('check_type').notNull(),
    status: complianceStatusEnum('status').default('pending').notNull(),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_compliance_account').on(table.accountId),
    index('idx_compliance_entity').on(table.entityType, table.entityId),
    index('idx_compliance_status').on(table.status),
    index('idx_compliance_expires').on(table.expiresAt),
  ],
);

export const complianceRecordsRelations = relations(complianceRecords, ({ one }) => ({
  account: one(accounts, {
    fields: [complianceRecords.accountId],
    references: [accounts.accountId],
  }),
}));

export const createComplianceSchema = z.object({
  entityType: z.string().min(1).max(50),
  entityId: z.string().uuid(),
  checkType: z.enum(['kyc', 'aml', 'risk_disclosure', 'regulatory']),
  status: z.enum(['pending', 'passed', 'failed', 'expired', 'waived']).optional(),
  checkedAt: z.date().or(z.string()).optional(),
  expiresAt: z.date().or(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateComplianceSchema = createComplianceSchema.partial();

export type CreateComplianceInput = z.infer<typeof createComplianceSchema>;
export type UpdateComplianceInput = z.infer<typeof updateComplianceSchema>;
