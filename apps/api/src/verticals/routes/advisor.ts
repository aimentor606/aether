import { Hono } from 'hono';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { advisorService } from '../services/advisor';
import { getAccountId, formatZodError, pagination } from '../middleware/account-context';
import {
  createPortfolioSchema,
  updatePortfolioSchema,
  createRiskAssessmentSchema,
  updateRiskAssessmentSchema,
  createFinancialPlanSchema,
  updateFinancialPlanSchema,
} from '@aether/db/schema/advisor';
import {
  createLeadSchema,
  updateLeadSchema,
  createDocumentSchema,
  createComplianceSchema,
} from '@aether/db/schema/shared-vertical';

const advisorRoutes = new Hono();

// ─── Portfolios (投资组合) ─────────────────────────────────────────────────────

advisorRoutes.get('/portfolios', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const portfolios = await advisorService.listPortfolios(accountId, { limit, offset });
    return c.json({ success: true, data: portfolios, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list portfolios' }, 500);
  }
});

advisorRoutes.post('/portfolios', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createPortfolioSchema.parse(body);
    const portfolio = await advisorService.createPortfolio(accountId, validated);
    return c.json({ success: true, data: portfolio }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create portfolio' }, 400);
  }
});

advisorRoutes.get('/portfolios/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const portfolio = await advisorService.getPortfolio(accountId, id!);
    if (!portfolio) return c.json({ success: false, error: 'Portfolio not found' }, 404);
    return c.json({ success: true, data: portfolio });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve portfolio' }, 500);
  }
});

advisorRoutes.put('/portfolios/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updatePortfolioSchema.parse(body);
    const portfolio = await advisorService.updatePortfolio(accountId, id!, validated);
    return c.json({ success: true, data: portfolio });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update portfolio' }, 400);
  }
});

advisorRoutes.delete('/portfolios/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await advisorService.deletePortfolio(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to delete portfolio' }, 500);
  }
});

// ─── Risk Assessments (风险评估) ──────────────────────────────────────────────

advisorRoutes.get('/risk-assessments', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const assessments = await advisorService.listRiskAssessments(accountId, { limit, offset });
    return c.json({ success: true, data: assessments, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list risk assessments' }, 500);
  }
});

advisorRoutes.post('/risk-assessments', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createRiskAssessmentSchema.parse(body);
    const assessment = await advisorService.createRiskAssessment(accountId, validated);
    return c.json({ success: true, data: assessment }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create risk assessment' }, 400);
  }
});

advisorRoutes.get('/risk-assessments/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const assessment = await advisorService.getRiskAssessment(accountId, id!);
    if (!assessment) return c.json({ success: false, error: 'Risk assessment not found' }, 404);
    return c.json({ success: true, data: assessment });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve risk assessment' }, 500);
  }
});

advisorRoutes.put('/risk-assessments/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateRiskAssessmentSchema.parse(body);
    const assessment = await advisorService.updateRiskAssessment(accountId, id!, validated);
    return c.json({ success: true, data: assessment });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update risk assessment' }, 400);
  }
});

advisorRoutes.delete('/risk-assessments/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await advisorService.deleteRiskAssessment(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to delete risk assessment' }, 500);
  }
});

// ─── Financial Plans (理财计划) ────────────────────────────────────────────────

advisorRoutes.get('/financial-plans', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const plans = await advisorService.listFinancialPlans(accountId, { limit, offset });
    return c.json({ success: true, data: plans, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list financial plans' }, 500);
  }
});

advisorRoutes.post('/financial-plans', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createFinancialPlanSchema.parse(body);
    const plan = await advisorService.createFinancialPlan(accountId, validated);
    return c.json({ success: true, data: plan }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create financial plan' }, 400);
  }
});

advisorRoutes.get('/financial-plans/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const plan = await advisorService.getFinancialPlan(accountId, id!);
    if (!plan) return c.json({ success: false, error: 'Financial plan not found' }, 404);
    return c.json({ success: true, data: plan });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve financial plan' }, 500);
  }
});

advisorRoutes.put('/financial-plans/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateFinancialPlanSchema.parse(body);
    const plan = await advisorService.updateFinancialPlan(accountId, id!, validated);
    return c.json({ success: true, data: plan });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update financial plan' }, 400);
  }
});

advisorRoutes.delete('/financial-plans/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await advisorService.deleteFinancialPlan(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to delete financial plan' }, 500);
  }
});

// ─── Leads (潜在客户) ─────────────────────────────────────────────────────────

advisorRoutes.get('/leads', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const leads = await advisorService.listLeads(accountId, { limit, offset });
    return c.json({ success: true, data: leads, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list leads' }, 500);
  }
});

advisorRoutes.post('/leads', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createLeadSchema.parse(body);
    const lead = await advisorService.createLead(accountId, validated);
    return c.json({ success: true, data: lead }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create lead' }, 400);
  }
});

advisorRoutes.get('/leads/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const lead = await advisorService.getLead(accountId, id!);
    if (!lead) return c.json({ success: false, error: 'Lead not found' }, 404);
    return c.json({ success: true, data: lead });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to retrieve lead' }, 500);
  }
});

advisorRoutes.put('/leads/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateLeadSchema.parse(body);
    const lead = await advisorService.updateLead(accountId, id!, validated);
    return c.json({ success: true, data: lead });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to update lead' }, 400);
  }
});

// ─── Documents (文档) ─────────────────────────────────────────────────────────

advisorRoutes.get('/documents', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const entityType = c.req.query('entity_type');
    const entityId = c.req.query('entity_id');
    const docs = await advisorService.listDocuments(accountId, { limit, offset, entityType, entityId });
    return c.json({ success: true, data: docs, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list documents' }, 500);
  }
});

advisorRoutes.post('/documents', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createDocumentSchema.parse(body);
    const doc = await advisorService.createDocument(accountId, validated);
    return c.json({ success: true, data: doc }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create document' }, 400);
  }
});

// ─── Compliance (合规) ────────────────────────────────────────────────────────

advisorRoutes.get('/compliance', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const entityType = c.req.query('entity_type');
    const entityId = c.req.query('entity_id');
    const records = await advisorService.listCompliance(accountId, { limit, offset, entityType, entityId });
    return c.json({ success: true, data: records, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to list compliance records' }, 500);
  }
});

advisorRoutes.post('/compliance', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createComplianceSchema.parse(body);
    const record = await advisorService.createCompliance(accountId, validated);
    return c.json({ success: true, data: record }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    return c.json({ success: false, error: 'Failed to create compliance record' }, 400);
  }
});

export { advisorRoutes };
