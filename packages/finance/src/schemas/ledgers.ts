import { uuid, text, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { acmeSchema, accounts } from '@acme/db';

// Ledger entry status enum
export const ledgerStatusEnum = acmeSchema.enum('ledger_status', [
  'posted',
  'draft',
  'reversed'
]);

// Ledgers table - double-entry accounting support
export const ledgers = acmeSchema.table('ledgers', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull(),
  journalEntry: text('journal_entry').notNull(),
  debitAmount: numeric('debit_amount', { precision: 19, scale: 2 }).default('0'),
  creditAmount: numeric('credit_amount', { precision: 19, scale: 2 }).default('0'),
  ledgerAccount: text('ledger_account').notNull(),
  description: text('description'),
  status: ledgerStatusEnum('status').default('draft').notNull(),
  entryDate: timestamp('entry_date').notNull(),
  reference: text('reference'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_ledgers_account').on(table.accountId),
  index('idx_ledgers_status').on(table.status),
  index('idx_ledgers_entry_date').on(table.entryDate),
  index('idx_ledgers_account_date').on(table.accountId, table.entryDate),
]);

// Ledger relations
export const ledgersRelations = relations(ledgers, ({ one }) => ({
  account: one(accounts, {
    fields: [ledgers.accountId],
    references: [accounts.accountId]
  })
}));

// Zod validation schemas
export const createLedgerSchema = z.object({
  journalEntry: z.string().min(1).max(255),
  debitAmount: z.string().or(z.number()).optional(),
  creditAmount: z.string().or(z.number()).optional(),
  ledgerAccount: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  status: z.enum(['posted', 'draft', 'reversed']).default('draft'),
  entryDate: z.coerce.date(),
  reference: z.string().max(255).optional(),
});

export const updateLedgerSchema = createLedgerSchema.partial();

export type CreateLedgerInput = z.infer<typeof createLedgerSchema>;
export type UpdateLedgerInput = z.infer<typeof updateLedgerSchema>;
