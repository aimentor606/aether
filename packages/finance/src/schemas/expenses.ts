import { uuid, varchar, text, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { acmeSchema, accounts } from '@acme/db';
import { z } from 'zod';

// Expense category enum
export const expenseCategoryEnum = acmeSchema.enum('expense_category', [
  'travel',
  'meals',
  'equipment',
  'software',
  'utilities',
  'rent',
  'salary',
  'marketing',
  'other',
]);

// Expense status enum
export const expenseStatusEnum = acmeSchema.enum('expense_status', [
  'draft',
  'submitted',
  'approved',
  'reimbursed',
  'rejected',
]);

// Expenses table (defined in acmeSchema for multi-tenant consistency)
export const expenses = acmeSchema.table(
  'expenses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    expenseNumber: varchar('expense_number', { length: 50 }).notNull(),
    employeeId: uuid('employee_id'),
    employeeName: varchar('employee_name', { length: 255 }).notNull(),
    category: expenseCategoryEnum('category').notNull(),
    description: text('description'),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    status: expenseStatusEnum('status').default('draft').notNull(),
    expenseDate: timestamp('expense_date', { withTimezone: true }).notNull(),
    submittedDate: timestamp('submitted_date', { withTimezone: true }),
    approvedDate: timestamp('approved_date', { withTimezone: true }),
    approverNotes: text('approver_notes'),
    receipts: jsonb('receipts').default([]).$type<ExpenseReceipt[]>(),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_expenses_account').on(table.accountId),
    index('idx_expenses_status').on(table.status),
    index('idx_expenses_category').on(table.category),
    index('idx_expenses_employee').on(table.employeeId, table.accountId),
    index('idx_expenses_date').on(table.expenseDate),
  ],
);

// Expense relations
export const expensesRelations = relations(expenses, ({ one }) => ({
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.accountId],
  }),
}));

// Types
export interface ExpenseReceipt {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

// Zod schemas for validation
export const expenseReceiptSchema = z.object({
  id: z.string().uuid().optional(),
  url: z.string().url(),
  filename: z.string().min(1),
  uploadedAt: z.string().datetime().optional(),
});

export const createExpenseSchema = z.object({
  expenseNumber: z.string().min(1).max(50),
  employeeId: z.string().uuid().optional(),
  employeeName: z.string().min(1).max(255),
  category: z.enum(['travel', 'meals', 'equipment', 'software', 'utilities', 'rent', 'salary', 'marketing', 'other']),
  description: z.string().optional(),
  amount: z.string().or(z.number()),
  currency: z.string().length(3).default('USD'),
  expenseDate: z.date().or(z.string()),
  receipts: z.array(expenseReceiptSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
