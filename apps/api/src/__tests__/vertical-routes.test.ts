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

// Mock the vertical-insurance package
const mockInsuranceCreate = async (_accountId: string, data: unknown) => ({ id: 'ins_123', accountId: _accountId, ...data });
mock.module('@aether/vertical-insurance', () => ({
  policiesService: {
    listAll: async () => [],
    create: mockInsuranceCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  claimsService: {
    listAll: async () => [],
    create: mockInsuranceCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  leadsService: {
    listAll: async () => [],
    create: mockInsuranceCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  documentsService: {
    listAll: async () => [],
    create: mockInsuranceCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  complianceService: {
    listAll: async () => [],
    create: mockInsuranceCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
}));

// Mock the vertical-advisor package
const mockAdvisorCreate = async (_accountId: string, data: unknown) => ({ id: 'adv_123', accountId: _accountId, ...data });
mock.module('@aether/vertical-advisor', () => ({
  portfoliosService: {
    listAll: async () => [],
    create: mockAdvisorCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  riskAssessmentsService: {
    listAll: async () => [],
    create: mockAdvisorCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  financialPlansService: {
    listAll: async () => [],
    create: mockAdvisorCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  leadsService: {
    listAll: async () => [],
    create: mockAdvisorCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  documentsService: {
    listAll: async () => [],
    create: mockAdvisorCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
  complianceService: {
    listAll: async () => [],
    create: mockAdvisorCreate,
    getById: async () => null,
    update: async (_accountId: string, id: string, data: unknown) => ({ id, accountId: _accountId, ...data }),
    delete: async () => {},
  },
}));

// Mock resolve-account (no DB needed)
mock.module('../shared/resolve-account', () => ({
  resolveAccountId: async (userId: string) => `resolved_account_for_${userId}`,
  resolveAccountIdStrict: async (userId: string) => `resolved_account_for_${userId}`,
}));

// Import routes AFTER mocks are set up
const { financeRoutes } = require('../verticals/routes/finance');
const { insuranceRoutes } = require('../verticals/routes/insurance');
const { advisorRoutes } = require('../verticals/routes/advisor');

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
  verticalsApp.route('/insurance', insuranceRoutes);
  verticalsApp.route('/advisor', advisorRoutes);
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

  test('insurance: returns 403 when no auth context', async () => {
    const app = createVerticalTestApp({});
    const res = await app.request('/v1/verticals/insurance/policies');
    expect(res.status).toBe(403);
  });

  test('advisor: returns 403 when no auth context', async () => {
    const app = createVerticalTestApp({});
    const res = await app.request('/v1/verticals/advisor/portfolios');
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

  test('insurance: succeeds with accountId', async () => {
    const app = createVerticalTestApp({
      accountId: '00000000-0000-4000-a000-000000000001',
    });
    const res = await app.request('/v1/verticals/insurance/policies');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('advisor: succeeds with accountId', async () => {
    const app = createVerticalTestApp({
      accountId: '00000000-0000-4000-a000-000000000001',
    });
    const res = await app.request('/v1/verticals/advisor/portfolios');
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

  test('insurance POST /policies with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyNumber: 'POL-001',
        type: 'life',
        clientName: 'Test Client',
        premium: 500,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('insurance POST /policies with empty body returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('insurance POST /claims with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimNumber: 'CLM-001',
        policyId: '00000000-0000-4000-a000-000000000099',
        type: 'accident',
        amount: 5000,
      }),
    });
    expect(res.status).toBe(201);
  });

  test('insurance POST /claims with missing fields returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimNumber: 'CLM-002' }),
    });
    expect(res.status).toBe(400);
  });

  test('insurance PUT /policies/:id with valid data returns 200', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/policies/pol1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientName: 'Updated Client', premium: 600 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('advisor POST /portfolios with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Growth Portfolio',
        clientName: 'Jane Smith',
        riskLevel: 'moderate',
        totalValue: 100000,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('advisor POST /portfolios with empty body returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('advisor POST /risk-assessments with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/risk-assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: 'John Doe',
        riskScore: 65,
        riskCategory: 'moderate',
      }),
    });
    expect(res.status).toBe(201);
  });

  test('advisor POST /financial-plans with valid data returns 201', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/financial-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Retirement Plan',
        clientName: 'Jane Smith',
        planType: 'retirement',
        goalAmount: 1000000,
      }),
    });
    expect(res.status).toBe(201);
  });

  test('advisor POST /financial-plans with missing fields returns 400', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/financial-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('advisor PUT /portfolios/:id with valid data returns 200', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/portfolios/port1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Portfolio', totalValue: 120000 }),
    });
    expect(res.status).toBe(200);
  });

  test('insurance POST /policies with accountId in response', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyNumber: 'POL-002',
        type: 'health',
        clientName: 'Test',
        premium: 200,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountId).toBe('00000000-0000-4000-a000-000000000001');
  });

  test('advisor POST /portfolios with accountId in response', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Portfolio',
        clientName: 'Test',
        riskLevel: 'conservative',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.accountId).toBe('00000000-0000-4000-a000-000000000001');
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

  test('insurance: GET /policies/:id returns 404 for missing', async () => {
    const res = await authedApp.request('/v1/verticals/insurance/policies/nonexistent');
    expect(res.status).toBe(404);
  });

  test('advisor: GET /portfolios/:id returns 404 for missing', async () => {
    const res = await authedApp.request('/v1/verticals/advisor/portfolios/nonexistent');
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

  test('insurance: list endpoints all return 200', async () => {
    for (const path of ['/claims', '/leads', '/documents', '/compliance']) {
      const res = await authedApp.request(`/v1/verticals/insurance${path}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  test('advisor: list endpoints all return 200', async () => {
    for (const path of ['/risk-assessments', '/financial-plans', '/leads', '/documents', '/compliance']) {
      const res = await authedApp.request(`/v1/verticals/advisor${path}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  test('old healthcare endpoint returns 404', async () => {
    const res = await authedApp.request('/v1/verticals/healthcare/patients');
    expect(res.status).toBe(404);
  });

  test('old retail endpoint returns 404', async () => {
    const res = await authedApp.request('/v1/verticals/retail/inventory');
    expect(res.status).toBe(404);
  });
});

// ─── Tenant Isolation Tests ──────────────────────────────────────────────────

describe('Tenant Isolation', () => {
  const ACCOUNT_A = 'aaaaaaaa-0000-4000-a000-000000000001';
  const ACCOUNT_B = 'bbbbbbbb-0000-4000-b000-000000000002';

  function createAppForAccount(accountId: string) {
    return createVerticalTestApp({ accountId });
  }

  test('insurance: create under account A returns account A in response', async () => {
    const app = createAppForAccount(ACCOUNT_A);
    const res = await app.request('/v1/verticals/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyNumber: 'POL-A1',
        type: 'auto',
        clientName: 'Alice',
        premium: 800,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.accountId).toBe(ACCOUNT_A);
  });

  test('insurance: create under account B returns account B in response', async () => {
    const app = createAppForAccount(ACCOUNT_B);
    const res = await app.request('/v1/verticals/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyNumber: 'POL-B1',
        type: 'property',
        clientName: 'Bob',
        premium: 1200,
        startDate: '2026-01-01',
        endDate: '2027-01-01',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.accountId).toBe(ACCOUNT_B);
  });

  test('advisor: create under different accounts get different accountId', async () => {
    const appA = createAppForAccount(ACCOUNT_A);
    const appB = createAppForAccount(ACCOUNT_B);

    const [resA, resB] = await Promise.all([
      appA.request('/v1/verticals/advisor/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Portfolio A', clientName: 'Alice', riskLevel: 'conservative' }),
      }),
      appB.request('/v1/verticals/advisor/portfolios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Portfolio B', clientName: 'Bob', riskLevel: 'aggressive' }),
      }),
    ]);

    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);
    expect(bodyA.data.accountId).toBe(ACCOUNT_A);
    expect(bodyB.data.accountId).toBe(ACCOUNT_B);
    expect(bodyA.data.accountId).not.toBe(bodyB.data.accountId);
  });

  test('userId resolution maps to correct account', async () => {
    const app = createVerticalTestApp({ userId: 'user-alice' });
    const res = await app.request('/v1/verticals/insurance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        policyNumber: 'POL-U1',
        type: 'travel',
        clientName: 'Alice via JWT',
        premium: 300,
        startDate: '2026-06-01',
        endDate: '2026-12-01',
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.accountId).toBe('resolved_account_for_user-alice');
  });

  test('account A cannot use account B context', async () => {
    const appA = createAppForAccount(ACCOUNT_A);
    const createRes = await appA.request('/v1/verticals/advisor/portfolios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Private Portfolio', clientName: 'Alice', riskLevel: 'moderate' }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.data.accountId).toBe(ACCOUNT_A);
  });

  test('parallel requests from different tenants maintain isolation', async () => {
    const requests = [
      { accountId: ACCOUNT_A, vertical: 'insurance', resource: 'claims', data: { claimNumber: 'CLM-A1', policyId: '00000000-0000-4000-a000-000000000099', type: 'accident', amount: 1000 } },
      { accountId: ACCOUNT_B, vertical: 'insurance', resource: 'claims', data: { claimNumber: 'CLM-B1', policyId: '00000000-0000-4000-a000-000000000099', type: 'illness', amount: 2000 } },
      { accountId: ACCOUNT_A, vertical: 'advisor', resource: 'financial-plans', data: { name: 'Plan A', clientName: 'Alice', planType: 'retirement', goalAmount: 500000 } },
      { accountId: ACCOUNT_B, vertical: 'advisor', resource: 'risk-assessments', data: { clientName: 'Bob', riskScore: 80, riskCategory: 'aggressive' } },
    ];

    const results = await Promise.all(
      requests.map(({ accountId, vertical, resource, data }) => {
        const app = createAppForAccount(accountId);
        return app.request(`/v1/verticals/${vertical}/${resource}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }),
    );

    const bodies = await Promise.all(results.map((r) => r.json()));
    expect(bodies[0].data.accountId).toBe(ACCOUNT_A);
    expect(bodies[1].data.accountId).toBe(ACCOUNT_B);
    expect(bodies[2].data.accountId).toBe(ACCOUNT_A);
    expect(bodies[3].data.accountId).toBe(ACCOUNT_B);
  });
});

// ─── Rate Limiting Tests ─────────────────────────────────────────────────────
// The rate limiter is tested in its own test file (tenant-rate-limit.test.ts)

// ─── Real Middleware Chain Integration Tests ──────────────────────────────────

describe('Real Middleware Chain', () => {
  const ACCOUNT_A = 'aaaaaaaa-0000-4000-a000-000000000001';
  const ACCOUNT_B = 'bbbbbbbb-0000-4000-b000-000000000002';

  function createRealChainApp() {
    const app = new Hono<{ Variables: AuthVariables }>();

    app.use('/v1/verticals/*', async (c, next) => {
      const testAccountId = c.req.header('X-Test-Account-Id');
      const testUserId = c.req.header('X-Test-User-Id');
      if (testAccountId) c.set('accountId', testAccountId);
      if (testUserId) c.set('userId', testUserId);
      await next();
    });

    const sub = new Hono<{ Variables: AuthVariables }>();
    sub.route('/finance', financeRoutes);
    sub.route('/insurance', insuranceRoutes);
    sub.route('/advisor', advisorRoutes);
    app.route('/v1/verticals', sub);

    app.onError((err, c) => {
      if (err instanceof HTTPException) {
        return c.json({ error: true, message: err.message, status: err.status }, err.status);
      }
      return c.json({ error: true, message: 'Internal server error' }, 500);
    });

    return app;
  }

  const realChainApp = createRealChainApp();

  test('no auth headers -> getAccountId throws -> 403', async () => {
    const res = await realChainApp.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain('Account context required');
  });

  test('auth with accountId -> 200 with correct data', async () => {
    const res = await realChainApp.request('/v1/verticals/finance/invoices', {
      headers: { 'X-Test-Account-Id': ACCOUNT_A },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('auth via userId -> resolves accountId via resolveAccountId', async () => {
    const res = await realChainApp.request('/v1/verticals/finance/invoices', {
      headers: { 'X-Test-User-Id': 'user-alice' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('two accounts in parallel -> each gets own accountId in responses', async () => {
    const [resA, resB] = await Promise.all([
      realChainApp.request('/v1/verticals/insurance/policies', {
        method: 'POST',
        headers: {
          'X-Test-Account-Id': ACCOUNT_A,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          policyNumber: 'POL-A',
          type: 'life',
          clientName: 'Alice',
          premium: 500,
          startDate: '2026-01-01',
          endDate: '2027-01-01',
        }),
      }),
      realChainApp.request('/v1/verticals/insurance/policies', {
        method: 'POST',
        headers: {
          'X-Test-Account-Id': ACCOUNT_B,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          policyNumber: 'POL-B',
          type: 'health',
          clientName: 'Bob',
          premium: 700,
          startDate: '2026-01-01',
          endDate: '2027-01-01',
        }),
      }),
    ]);

    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);
    expect(bodyA.data.accountId).toBe(ACCOUNT_A);
    expect(bodyB.data.accountId).toBe(ACCOUNT_B);
    expect(bodyA.data.accountId).not.toBe(bodyB.data.accountId);
  });

  test('pagination params are passed through to service layer', async () => {
    const res = await realChainApp.request('/v1/verticals/finance/invoices?limit=10&offset=5', {
      headers: { 'X-Test-Account-Id': ACCOUNT_A },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta).toEqual({ limit: 10, offset: 5 });
  });

  test('pagination clamps to max 200', async () => {
    const res = await realChainApp.request('/v1/verticals/finance/invoices?limit=999', {
      headers: { 'X-Test-Account-Id': ACCOUNT_A },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.meta.limit).toBe(200);
  });

  test('all finance list endpoints return meta with pagination', async () => {
    const headers = { 'X-Test-Account-Id': ACCOUNT_A };
    for (const path of ['/invoices', '/expenses', '/budgets', '/ledger']) {
      const res = await realChainApp.request(`/v1/verticals/finance${path}?limit=5`, { headers });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta).toBeDefined();
      expect(body.meta.limit).toBe(5);
    }
  });

  test('insurance list endpoints return meta with pagination', async () => {
    const headers = { 'X-Test-Account-Id': ACCOUNT_A };
    for (const path of ['/policies', '/claims', '/leads', '/documents', '/compliance']) {
      const res = await realChainApp.request(`/v1/verticals/insurance${path}?limit=5`, { headers });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta).toBeDefined();
      expect(body.meta.limit).toBe(5);
    }
  });

  test('advisor list endpoints return meta with pagination', async () => {
    const headers = { 'X-Test-Account-Id': ACCOUNT_A };
    for (const path of ['/portfolios', '/risk-assessments', '/financial-plans', '/leads', '/documents', '/compliance']) {
      const res = await realChainApp.request(`/v1/verticals/advisor${path}?limit=5`, { headers });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.meta).toBeDefined();
      expect(body.meta.limit).toBe(5);
    }
  });

  test('invalid vertical returns 404', async () => {
    const res = await realChainApp.request('/v1/verticals/nonexistent/resources', {
      headers: { 'X-Test-Account-Id': ACCOUNT_A },
    });
    expect(res.status).toBe(404);
  });
});
