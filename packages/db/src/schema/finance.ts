import { uuid, varchar, text, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { aetherSchema, accounts } from './aether';
import { z } from 'zod';

// ============================================================================
// INVOICES
// ============================================================================

export const invoiceStatusEnum = aetherSchema.enum('invoice_status', [
  'draft',
  'sent',
  'paid',
  'overdue',
  'cancelled',
]);

export const invoices = aetherSchema.table(
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

export const invoicesRelations = relations(invoices, ({ one }) => ({
  account: one(accounts, {
    fields: [invoices.accountId],
    references: [accounts.accountId],
  }),
}));

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export const invoiceItemSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
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
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  issuedDate: z.date().or(z.string()).optional(),
  items: z.array(invoiceItemSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateInvoiceSchema = createInvoiceSchema.partial();

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;

// ============================================================================
// EXPENSES
// ============================================================================

export const expenseCategoryEnum = aetherSchema.enum('expense_category', [
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

export const expenseStatusEnum = aetherSchema.enum('expense_status', [
  'draft',
  'submitted',
  'approved',
  'reimbursed',
  'rejected',
]);

export const expenses = aetherSchema.table(
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

export const expensesRelations = relations(expenses, ({ one }) => ({
  account: one(accounts, {
    fields: [expenses.accountId],
    references: [accounts.accountId],
  }),
}));

export interface ExpenseReceipt {
  id: string;
  url: string;
  filename: string;
  uploadedAt: string;
}

export const expenseReceiptSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  filename: z.string().min(1),
  uploadedAt: z.string().datetime(),
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

// ============================================================================
// BUDGETS
// ============================================================================

export const budgetPeriodEnum = aetherSchema.enum('budget_period', [
  'monthly',
  'quarterly',
  'yearly',
  'custom',
]);

export const budgetStatusEnum = aetherSchema.enum('budget_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const budgets = aetherSchema.table(
  'budgets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    budgetName: varchar('budget_name', { length: 255 }).notNull(),
    period: budgetPeriodEnum('period').default('monthly').notNull(),
    totalBudget: numeric('total_budget', { precision: 12, scale: 2 }).notNull(),
    spent: numeric('spent', { precision: 12, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    status: budgetStatusEnum('status').default('draft').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    departmentId: uuid('department_id'),
    departmentName: varchar('department_name', { length: 255 }),
    categories: jsonb('categories').default([]).$type<BudgetCategory[]>(),
    alerts: jsonb('alerts').default([]).$type<BudgetAlert[]>(),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_budgets_account').on(table.accountId),
    index('idx_budgets_status').on(table.status),
    index('idx_budgets_period').on(table.period),
    index('idx_budgets_dates').on(table.startDate, table.endDate),
  ],
);

export const budgetsRelations = relations(budgets, ({ one }) => ({
  account: one(accounts, {
    fields: [budgets.accountId],
    references: [accounts.accountId],
  }),
}));

export interface BudgetCategory {
  id?: string;
  categoryName: string;
  allocated: number;
  spent: number;
  threshold?: number;
}

export interface BudgetAlert {
  id?: string;
  type: 'threshold' | 'overspend' | 'approaching_limit';
  message: string;
  createdAt?: string;
  acknowledged: boolean;
}

export const budgetCategorySchema = z.object({
  id: z.string().uuid().optional(),
  categoryName: z.string().min(1).max(255),
  allocated: z.number().nonnegative(),
  spent: z.number().nonnegative().default(0),
  threshold: z.number().nonnegative().optional(),
});

export const budgetAlertSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.enum(['threshold', 'overspend', 'approaching_limit']),
  message: z.string().min(1),
  createdAt: z.string().datetime().optional(),
  acknowledged: z.boolean().default(false),
});

export const createBudgetSchema = z.object({
  budgetName: z.string().min(1).max(255),
  period: z.enum(['monthly', 'quarterly', 'yearly', 'custom']).default('monthly'),
  totalBudget: z.string().or(z.number()),
  currency: z.string().length(3).default('USD'),
  startDate: z.date().or(z.string()),
  endDate: z.date().or(z.string()),
  departmentId: z.string().uuid().optional(),
  departmentName: z.string().max(255).optional(),
  categories: z.array(budgetCategorySchema).optional(),
  alerts: z.array(budgetAlertSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

// ============================================================================
// LEDGERS
// ============================================================================

export const ledgerStatusEnum = aetherSchema.enum('ledger_status', [
  'posted',
  'draft',
  'reversed'
]);

export const ledgers = aetherSchema.table('ledgers', {
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

export const ledgersRelations = relations(ledgers, ({ one }) => ({
  account: one(accounts, {
    fields: [ledgers.accountId],
    references: [accounts.accountId]
  })
}));

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
