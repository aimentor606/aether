import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';

mock.module('@aether/vertical-finance', () => ({
  invoicesService: {
    listAll: async () => [],
    create: async (_accountId: string, data: Record<string, unknown>) => ({ id: 'inv_123', ...data }),
    getById: async () => null,
    update: async (_accountId: string, id: string, data: Record<string, unknown>) => ({ id, ...data }),
    delete: async () => {},
  },
  expensesService: {
    listAll: async () => [],
    create: async (_accountId: string, data: Record<string, unknown>) => ({ id: 'exp_123', ...data }),
  },
  budgetsService: {
    listAll: async () => [],
    create: async (_accountId: string, data: Record<string, unknown>) => ({ id: 'bgt_123', ...data }),
  },
  ledgersService: {
    listAll: async () => [],
    create: async (_accountId: string, data: Record<string, unknown>) => ({ id: 'ldg_123', ...data }),
  },
  default: { verticalId: 'finance', name: 'Finance' },
}));

mock.module('../shared/resolve-account', () => ({
  resolveAccountId: async (userId: string) => `resolved_account_for_${userId}`,
  resolveAccountIdStrict: async (userId: string) => `resolved_account_for_${userId}`,
}));

const { verticalsApp } = require('../verticals');

function createApp() {
  const app = new Hono<{ Variables: { accountId: string } }>();
  app.use('/v1/verticals/*', async (c, next) => {
    c.set('accountId', 'preview-gate-account');
    await next();
  });
  app.route('/v1/verticals', verticalsApp);
  return app;
}

describe('Vertical preview gate', () => {
  const app = createApp();

  test('healthcare routes return explicit 501 preview response', async () => {
    const res = await app.request('/v1/verticals/healthcare/patients');
    expect(res.status).toBe(501);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.meta.vertical).toBe('healthcare');
    expect(body.meta.status).toBe('preview');
  });

  test('retail routes return explicit 501 preview response', async () => {
    const res = await app.request('/v1/verticals/retail/inventory');
    expect(res.status).toBe(501);

    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.meta.vertical).toBe('retail');
    expect(body.meta.status).toBe('preview');
  });

  test('finance routes remain available', async () => {
    const res = await app.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
