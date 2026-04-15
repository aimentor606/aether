import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

// Mock the vertical-finance package (has DB connection at module level)
mock.module('@aether/vertical-finance', () => ({
  invoicesService: {
    listAll: async () => [],
    create: async (_accountId: string, data: unknown) => ({ id: 'inv_123', ...data }),
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, ...data }),
    delete: async () => {},
  },
  expensesService: {
    listAll: async () => [],
    create: async (_accountId: string, data: unknown) => ({ id: 'exp_123', ...data }),
  },
  budgetsService: {
    listAll: async () => [],
    create: async (_accountId: string, data: unknown) => ({ id: 'bgt_123', ...data }),
  },
  ledgersService: {
    listAll: async () => [],
    create: async (_accountId: string, data: unknown) => ({ id: 'ldg_123', ...data }),
  },
  default: { verticalId: 'finance', name: 'Finance' },
}));

// Mock resolve-account (no DB needed)
mock.module('../shared/resolve-account', () => ({
  resolveAccountId: async (userId: string) => `resolved_account_for_${userId}`,
}));

// Import routes AFTER mocks are set up
const { financeRoutes } = require('../verticals/routes/finance');
const { healthcareRoutes } = require('../verticals/routes/healthcare');
const { retailRoutes } = require('../verticals/routes/retail');

interface AuthVariables {
  userId?: string;
  userEmail?: string;
  accountId?: string;
}

function createVerticalTestApp(auth: AuthVariables = {}) {
  const app = new Hono<{ Variables: AuthVariables }>();

  app.use('/v1/verticals/*', async (c, next) => {
    if (auth.accountId) c.set('accountId', auth.accountId);
    if (auth.userId) c.set('userId', auth.userId);
    if (auth.userEmail) c.set('userEmail', auth.userEmail);
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: true, message: err.message, status: err.status }, err.status);
    }
    return c.json({ error: true, message: 'Internal server error' }, 500);
  });

  const verticalsApp = new Hono<{ Variables: AuthVariables }>();
  verticalsApp.route('/finance', financeRoutes);
  verticalsApp.route('/healthcare', healthcareRoutes);
  verticalsApp.route('/retail', retailRoutes);
  app.route('/v1/verticals', verticalsApp);

  return app;
}

// ─── Auth Tests ──────────────────────────────────────────────────────────────

describe('Vertical Route Auth', () => {
  test('finance: returns 403 when no auth context', async () => {
    const app = createVerticalTestApp({});
    const res = await app.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain('Account context required');
  });

  test('healthcare: returns 403 when no auth context', async () => {
    const app = createVerticalTestApp({});
    const res = await app.request('/v1/verticals/healthcare/patients');
    expect(res.status).toBe(403);
  });

  test('retail: returns 403 when no auth context', async () => {
    const app = createVerticalTestApp({});
    const res = await app.request('/v1/verticals/retail/inventory');
    expect(res.status).toBe(403);
  });

  test('finance: succeeds with accountId (API key path)', async () => {
    const app = createVerticalTestApp({
      accountId: '00000000-0000-4000-a000-000000000001',
    });
    const res = await app.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('finance: resolves accountId from userId (Supabase JWT path)', async () => {
    const app = createVerticalTestApp({
      userId: 'user-abc-123',
    });
    const res = await app.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('healthcare: succeeds with accountId', async () => {
    const app = createVerticalTestApp({
      accountId: '00000000-0000-4000-a000-000000000001',
    });
    const res = await app.request('/v1/verticals/healthcare/patients');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('retail: succeeds with accountId', async () => {
    const app = createVerticalTestApp({
      accountId: '00000000-0000-4000-a000-000000000001',
    });
    const res = await app.request('/v1/verticals/retail/inventory');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── Validation Tests ────────────────────────────────────────────────────────

describe('Vertical Route Validation', () => {
  const authedApp = createVerticalTestApp({
    accountId: '00000000-0000-4000-a000-000000000001',
  });

  test('finance POST /invoices with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/finance/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoiceNumber: 'INV-001',
        clientName: 'Test Client',
        amount: 1000,
        currency: 'USD',
        status: 'draft',
        issueDate: '2026-04-14',
        dueDate: '2026-05-14',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('finance POST /invoices with empty body returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/finance/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('finance POST /expenses with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/finance/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expenseNumber: 'EXP-001',
        employeeName: 'Jane Smith',
        category: 'equipment',
        amount: 50,
        currency: 'USD',
        expenseDate: '2026-04-14',
        description: 'Office supplies',
      }),
    });
    expect(res.status).toBe(201);
  });

  test('finance POST /budgets with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/finance/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        budgetName: 'Q2 Budget',
        period: 'quarterly',
        startDate: '2026-04-01',
        endDate: '2026-06-30',
        totalBudget: 50000,
        currency: 'USD',
      }),
    });
    expect(res.status).toBe(201);
  });

  test('finance POST /ledger with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/finance/ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        journalEntry: 'JE-001',
        debitAmount: 1000,
        ledgerAccount: 'accounts_receivable',
        description: 'Test entry',
        entryDate: '2026-04-14',
        status: 'draft',
      }),
    });
    expect(res.status).toBe(201);
  });

  test('healthcare POST /patients with empty body returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('healthcare POST /appointments with missing fields returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'p1' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('healthcare POST /prescriptions with missing fields returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/prescriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: 'p1' }),
    });
    expect(res.status).toBe(400);
  });

  test('healthcare PUT /patients/:id with valid data returns 200', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/patients/p1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jane Doe', phone: '555-0100' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('healthcare POST /patients with accountId in response', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'John Doe' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountId).toBe('00000000-0000-4000-a000-000000000001');
  });

  test('retail POST /inventory with accountId in response', async () => {
    const res = await authedApp.request('/v1/verticals/retail/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Widget', sku: 'WDG-001' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountId).toBe('00000000-0000-4000-a000-000000000001');
  });

  test('retail POST /inventory with empty body returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/retail/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('retail POST /sales with missing fields returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/retail/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('retail POST /loyalty with missing fields returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/retail/loyalty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('retail PUT /inventory/:id with valid data returns 200', async () => {
    const res = await authedApp.request('/v1/verticals/retail/inventory/item1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Widget', quantity: 10 }),
    });
    expect(res.status).toBe(200);
  });
});

// ─── CRUD Tests ──────────────────────────────────────────────────────────────

describe('Vertical Route CRUD', () => {
  const authedApp = createVerticalTestApp({
    accountId: '00000000-0000-4000-a000-000000000001',
  });

  test('finance: GET /invoices/:id returns 404 for missing', async () => {
    const res = await authedApp.request('/v1/verticals/finance/invoices/nonexistent');
    expect(res.status).toBe(404);
  });

  test('healthcare: GET /patients/:id returns 404 for missing', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/patients/nonexistent');
    expect(res.status).toBe(404);
  });

  test('retail: GET /inventory/:id returns 404 for missing', async () => {
    const res = await authedApp.request('/v1/verticals/retail/inventory/nonexistent');
    expect(res.status).toBe(404);
  });

  test('finance: list endpoints all return 200', async () => {
    for (const path of ['/expenses', '/budgets', '/ledger']) {
      const res = await authedApp.request(`/v1/verticals/finance${path}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    }
  });

  test('healthcare: list endpoints all return 200', async () => {
    for (const path of ['/appointments', '/prescriptions']) {
      const res = await authedApp.request(`/v1/verticals/healthcare${path}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  test('retail: list endpoints all return 200', async () => {
    for (const path of ['/sales', '/loyalty']) {
      const res = await authedApp.request(`/v1/verticals/retail${path}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  test('compliance endpoint removed from healthcare', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/compliance');
    expect(res.status).toBe(404);
  });

  test('compliance endpoint removed from retail', async () => {
    const res = await authedApp.request('/v1/verticals/retail/compliance');
    expect(res.status).toBe(404);
  });
});
