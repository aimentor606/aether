import { uuid, varchar, text, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { acmeSchema, accounts } from '@acme/db';
import { z } from 'zod';

// Invoice status enum
export const invoiceStatusEnum = acmeSchema.enum('invoice_status', [
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
]);

// Invoices table (defined in acmeSchema for multi-tenant consistency)
export const invoices = acmeSchema.table(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
    clientId: uuid('client_id'),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    clientEmail: varchar('client_email', { length: 255 }),
    description: text('description'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    status: invoiceStatusEnum('status').default('draft').notNull(),
    dueDate: timestamp('due_date', { withTimezone: true }),
    issuedDate: timestamp('issued_date', { withTimezone: true }).defaultNow().notNull(),
    paidDate: timestamp('paid_date', { withTimezone: true }),
    items: jsonb('items').default([]).$type<InvoiceItem[]>(),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_invoices_account').on(table.accountId),
    index('idx_invoices_status').on(table.status),
    index('idx_invoices_due_date').on(table.dueDate),
    index('idx_invoices_invoice_number').on(table.invoiceNumber, table.accountId),
  ],
);

// Invoice relations
export const invoicesRelations = relations(invoices, ({ one }) => ({
  account: one(accounts, {
    fields: [invoices.accountId],
    references: [accounts.accountId],
  }),
}));

// Types
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// Zod schemas for validation
export const invoiceItemSchema = z.object({
  id: z.string().uuid().optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  amount: z.number().positive(),
});

export const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(50),
  clientName: z.string().min(1).max(255),
  clientEmail: z.string().email().optional(),
  clientId: z.string().uuid().optional(),
  description: z.string().optional(),
  amount: z.string().or(z.number()),
  currency: z.string().length(3).default('USD'),
  dueDate: z.date().or(z.string()).optional(),
  items: z.array(invoiceItemSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
