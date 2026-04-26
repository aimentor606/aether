import { Hono } from 'hono';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { insuranceService } from '../services/insurance';
import { getAccountId, formatZodError, pagination } from '../middleware/account-context';
import {
  createPolicySchema,
  updatePolicySchema,
  createClaimSchema,
  updateClaimSchema,
} from '@aether/db/schema/insurance';
import {
  createLeadSchema,
  updateLeadSchema,
  createDocumentSchema,
  createComplianceSchema,
} from '@aether/db/schema/shared-vertical';
import { logger } from '../../lib/logger';

const insuranceRoutes = new Hono();

// ─── Policies (保单) ──────────────────────────────────────────────────────────

insuranceRoutes.get('/policies', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const policies = await insuranceService.listPolicies(accountId, { limit, offset });
    return c.json({ success: true, data: policies, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to list policies', { error: String(error) });
    return c.json({ success: false, error: 'Failed to list policies' }, 500);
  }
});

insuranceRoutes.post('/policies', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createPolicySchema.parse(body);
    const policy = await insuranceService.createPolicy(accountId, validated);
    return c.json({ success: true, data: policy }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to create policy', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create policy' }, 400);
  }
});

insuranceRoutes.get('/policies/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const policy = await insuranceService.getPolicy(accountId, id!);
    if (!policy) return c.json({ success: false, error: 'Policy not found' }, 404);
    return c.json({ success: true, data: policy });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to retrieve policy', { error: String(error) });
    return c.json({ success: false, error: 'Failed to retrieve policy' }, 500);
  }
});

insuranceRoutes.put('/policies/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updatePolicySchema.parse(body);
    const policy = await insuranceService.updatePolicy(accountId, id!, validated);
    return c.json({ success: true, data: policy });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to update policy', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update policy' }, 400);
  }
});

insuranceRoutes.delete('/policies/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await insuranceService.deletePolicy(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to delete policy', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete policy' }, 500);
  }
});

// ─── Claims (理赔) ────────────────────────────────────────────────────────────

insuranceRoutes.get('/claims', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const claims = await insuranceService.listClaims(accountId, { limit, offset });
    return c.json({ success: true, data: claims, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to list claims', { error: String(error) });
    return c.json({ success: false, error: 'Failed to list claims' }, 500);
  }
});

insuranceRoutes.post('/claims', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createClaimSchema.parse(body);
    const claim = await insuranceService.createClaim(accountId, validated);
    return c.json({ success: true, data: claim }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to create claim', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create claim' }, 400);
  }
});

insuranceRoutes.get('/claims/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const claim = await insuranceService.getClaim(accountId, id!);
    if (!claim) return c.json({ success: false, error: 'Claim not found' }, 404);
    return c.json({ success: true, data: claim });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to retrieve claim', { error: String(error) });
    return c.json({ success: false, error: 'Failed to retrieve claim' }, 500);
  }
});

insuranceRoutes.put('/claims/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateClaimSchema.parse(body);
    const claim = await insuranceService.updateClaim(accountId, id!, validated);
    return c.json({ success: true, data: claim });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to update claim', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update claim' }, 400);
  }
});

insuranceRoutes.delete('/claims/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    await insuranceService.deleteClaim(accountId, id!);
    return c.json({ success: true });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to delete claim', { error: String(error) });
    return c.json({ success: false, error: 'Failed to delete claim' }, 500);
  }
});

// ─── Leads (潜在客户) ─────────────────────────────────────────────────────────

insuranceRoutes.get('/leads', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const leads = await insuranceService.listLeads(accountId, { limit, offset });
    return c.json({ success: true, data: leads, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to list leads', { error: String(error) });
    return c.json({ success: false, error: 'Failed to list leads' }, 500);
  }
});

insuranceRoutes.post('/leads', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createLeadSchema.parse(body);
    const lead = await insuranceService.createLead(accountId, validated);
    return c.json({ success: true, data: lead }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to create lead', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create lead' }, 400);
  }
});

insuranceRoutes.get('/leads/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const lead = await insuranceService.getLead(accountId, id!);
    if (!lead) return c.json({ success: false, error: 'Lead not found' }, 404);
    return c.json({ success: true, data: lead });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to retrieve lead', { error: String(error) });
    return c.json({ success: false, error: 'Failed to retrieve lead' }, 500);
  }
});

insuranceRoutes.put('/leads/:id', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const validated = updateLeadSchema.parse(body);
    const lead = await insuranceService.updateLead(accountId, id!, validated);
    return c.json({ success: true, data: lead });
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to update lead', { error: String(error) });
    return c.json({ success: false, error: 'Failed to update lead' }, 400);
  }
});

// ─── Documents (文档) ─────────────────────────────────────────────────────────

insuranceRoutes.get('/documents', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const entityType = c.req.query('entity_type');
    const entityId = c.req.query('entity_id');
    const docs = await insuranceService.listDocuments(accountId, { limit, offset, entityType, entityId });
    return c.json({ success: true, data: docs, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to list documents', { error: String(error) });
    return c.json({ success: false, error: 'Failed to list documents' }, 500);
  }
});

insuranceRoutes.post('/documents', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createDocumentSchema.parse(body);
    const doc = await insuranceService.createDocument(accountId, validated);
    return c.json({ success: true, data: doc }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to create document', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create document' }, 400);
  }
});

// ─── Compliance (合规) ────────────────────────────────────────────────────────

insuranceRoutes.get('/compliance', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const { limit, offset } = pagination(c);
    const entityType = c.req.query('entity_type');
    const entityId = c.req.query('entity_id');
    const records = await insuranceService.listCompliance(accountId, { limit, offset, entityType, entityId });
    return c.json({ success: true, data: records, meta: { limit, offset } });
  } catch (error) {
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to list compliance records', { error: String(error) });
    return c.json({ success: false, error: 'Failed to list compliance records' }, 500);
  }
});

insuranceRoutes.post('/compliance', async (c: Context) => {
  try {
    const accountId = await getAccountId(c);
    const body = await c.req.json();
    const validated = createComplianceSchema.parse(body);
    const record = await insuranceService.createCompliance(accountId, validated);
    return c.json({ success: true, data: record }, 201);
  } catch (error) {
    if (error instanceof ZodError) return c.json(formatZodError(error), 400);
    if (error instanceof HTTPException) throw error;
    logger.error('[verticals/insurance] Failed to create compliance record', { error: String(error) });
    return c.json({ success: false, error: 'Failed to create compliance record' }, 400);
  }
});

export { insuranceRoutes };
