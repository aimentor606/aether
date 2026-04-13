import { uuid, varchar, text, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { acmeSchema, accounts } from '@acme/db';
import { z } from 'zod';

// Budget period enum
export const budgetPeriodEnum = acmeSchema.enum('budget_period', [
  'monthly',
  'quarterly',
  'yearly',
  'custom',
]);

// Budget status enum
export const budgetStatusEnum = acmeSchema.enum('budget_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

// Budgets table (defined in acmeSchema for multi-tenant consistency)
export const budgets = acmeSchema.table(
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

// Budget relations
export const budgetsRelations = relations(budgets, ({ one }) => ({
  account: one(accounts, {
    fields: [budgets.accountId],
    references: [accounts.accountId],
  }),
}));

// Types
export interface BudgetCategory {
  id: string;
  categoryName: string;
  allocated: number;
  spent: number;
  threshold?: number;
}

export interface BudgetAlert {
  id: string;
  type: 'threshold' | 'overspend' | 'approaching_limit';
  message: string;
  createdAt: string;
  acknowledged: boolean;
}

// Zod schemas for validation
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
