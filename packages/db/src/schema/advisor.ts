import { uuid, varchar, text, numeric, integer, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { aetherSchema, accounts } from './aether';
import { z } from 'zod';

// ============================================================================
// PORTFOLIOS (投资组合)
// ============================================================================

export const riskLevelEnum = aetherSchema.enum('risk_level', [
  'conservative',
  'moderate',
  'aggressive',
]);

export const portfolioStatusEnum = aetherSchema.enum('portfolio_status', [
  'active',
  'frozen',
  'closed',
]);

export const portfolios = aetherSchema.table(
  'portfolios',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    clientId: uuid('client_id'),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    totalValue: numeric('total_value', { precision: 15, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    riskLevel: riskLevelEnum('risk_level').default('moderate').notNull(),
    status: portfolioStatusEnum('status').default('active').notNull(),
    holdings: jsonb('holdings').default([]).$type<PortfolioHolding[]>(),
    performance: jsonb('performance').default({}).$type<Record<string, unknown>>(),
    lastRebalanced: timestamp('last_rebalanced', { withTimezone: true }),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_portfolios_account').on(table.accountId),
    index('idx_portfolios_status').on(table.status),
    index('idx_portfolios_risk').on(table.riskLevel),
    index('idx_portfolios_client').on(table.clientId, table.accountId),
  ],
);

export const portfoliosRelations = relations(portfolios, ({ one }) => ({
  account: one(accounts, {
    fields: [portfolios.accountId],
    references: [accounts.accountId],
  }),
}));

export interface PortfolioHolding {
  symbol: string;
  name: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  allocation: number;
}

export const portfolioHoldingSchema = z.object({
  symbol: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().positive(),
  averageCost: z.number().nonnegative(),
  currentPrice: z.number().nonnegative(),
  allocation: z.number().min(0).max(1),
});

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  totalValue: z.string().or(z.number()).optional(),
  currency: z.string().length(3).default('USD'),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  status: z.enum(['active', 'frozen', 'closed']).optional(),
  holdings: z.array(portfolioHoldingSchema).optional(),
  performance: z.record(z.unknown()).optional(),
  lastRebalanced: z.date().or(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updatePortfolioSchema = createPortfolioSchema.partial();

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioInput = z.infer<typeof updatePortfolioSchema>;

// ============================================================================
// RISK ASSESSMENTS (风险评估)
// ============================================================================

export const riskCategoryEnum = aetherSchema.enum('risk_category', [
  'conservative',
  'moderately_conservative',
  'moderate',
  'moderately_aggressive',
  'aggressive',
]);

export const riskAssessments = aetherSchema.table(
  'risk_assessments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    clientId: uuid('client_id'),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    riskScore: integer('risk_score').notNull(),
    riskCategory: riskCategoryEnum('risk_category').notNull(),
    answers: jsonb('answers').default([]).$type<RiskAnswer[]>(),
    assessedAt: timestamp('assessed_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    notes: text('notes'),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_risk_assessments_account').on(table.accountId),
    index('idx_risk_assessments_category').on(table.riskCategory),
    index('idx_risk_assessments_client').on(table.clientId, table.accountId),
    index('idx_risk_assessments_expires').on(table.expiresAt),
  ],
);

export const riskAssessmentsRelations = relations(riskAssessments, ({ one }) => ({
  account: one(accounts, {
    fields: [riskAssessments.accountId],
    references: [accounts.accountId],
  }),
}));

export interface RiskAnswer {
  questionId: string;
  question: string;
  answer: string;
  score: number;
}

export const riskAnswerSchema = z.object({
  questionId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1),
  score: z.number().int().min(1),
});

export const createRiskAssessmentSchema = z.object({
  clientName: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  riskScore: z.number().int().min(1).max(100),
  riskCategory: z.enum(['conservative', 'moderately_conservative', 'moderate', 'moderately_aggressive', 'aggressive']),
  answers: z.array(riskAnswerSchema).optional(),
  assessedAt: z.date().or(z.string()).optional(),
  expiresAt: z.date().or(z.string()).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateRiskAssessmentSchema = createRiskAssessmentSchema.partial();

export type CreateRiskAssessmentInput = z.infer<typeof createRiskAssessmentSchema>;
export type UpdateRiskAssessmentInput = z.infer<typeof updateRiskAssessmentSchema>;

// ============================================================================
// FINANCIAL PLANS (理财计划)
// ============================================================================

export const planTypeEnum = aetherSchema.enum('plan_type', [
  'retirement',
  'education',
  'wealth_preservation',
  'growth',
]);

export const planStatusEnum = aetherSchema.enum('plan_status', [
  'draft',
  'active',
  'completed',
  'archived',
]);

export const financialPlans = aetherSchema.table(
  'financial_plans',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id').notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    clientId: uuid('client_id'),
    clientName: varchar('client_name', { length: 255 }).notNull(),
    planType: planTypeEnum('plan_type').notNull(),
    goalAmount: numeric('goal_amount', { precision: 15, scale: 2 }).notNull(),
    currentProgress: numeric('current_progress', { precision: 5, scale: 2 }).default('0').notNull(),
    currency: varchar('currency', { length: 3 }).default('USD').notNull(),
    timeline: varchar('timeline', { length: 100 }),
    milestones: jsonb('milestones').default([]).$type<PlanMilestone[]>(),
    status: planStatusEnum('status').default('draft').notNull(),
    metadata: jsonb('metadata').default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_financial_plans_account').on(table.accountId),
    index('idx_financial_plans_status').on(table.status),
    index('idx_financial_plans_type').on(table.planType),
    index('idx_financial_plans_client').on(table.clientId, table.accountId),
  ],
);

export const financialPlansRelations = relations(financialPlans, ({ one }) => ({
  account: one(accounts, {
    fields: [financialPlans.accountId],
    references: [accounts.accountId],
  }),
}));

export interface PlanMilestone {
  id: string;
  name: string;
  targetDate: string;
  targetAmount: number;
  completed: boolean;
}

export const planMilestoneSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  name: z.string().min(1),
  targetDate: z.string().min(1),
  targetAmount: z.number().nonnegative(),
  completed: z.boolean().default(false),
});

export const createFinancialPlanSchema = z.object({
  name: z.string().min(1).max(255),
  clientName: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  planType: z.enum(['retirement', 'education', 'wealth_preservation', 'growth']),
  goalAmount: z.string().or(z.number()),
  currentProgress: z.string().or(z.number()).optional(),
  currency: z.string().length(3).default('USD'),
  timeline: z.string().max(100).optional(),
  milestones: z.array(planMilestoneSchema).optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const updateFinancialPlanSchema = createFinancialPlanSchema.partial();

export type CreateFinancialPlanInput = z.infer<typeof createFinancialPlanSchema>;
export type UpdateFinancialPlanInput = z.infer<typeof updateFinancialPlanSchema>;
