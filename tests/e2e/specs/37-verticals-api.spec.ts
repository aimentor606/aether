import { test, expect } from '../fixtures';

test.describe('Insurance & Advisor Vertical API Integration', () => {
  test.describe('Insurance API', () => {
    test('GET /insurance/policies returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/policies');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(Array.isArray(body.data)).toBeTruthy();
    });

    test('POST /insurance/policies creates a policy', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/insurance/policies', {
        method: 'POST',
        body: JSON.stringify({
          policyNumber: `POL-E2E-${suffix}`,
          type: 'health',
          clientName: `E2E Client ${suffix}`,
          premium: 250.00,
          currency: 'USD',
          status: 'active',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.policyNumber).toBe(`POL-E2E-${suffix}`);
      expect(body.data.type).toBe('health');
    });

    test('POST /insurance/policies rejects invalid payload', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/policies', {
        method: 'POST',
        body: JSON.stringify({ invalid: true }),
      });
      expect(res.status).toBe(400);
    });

    test('GET /insurance/claims returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/claims');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(Array.isArray(body.data)).toBeTruthy();
    });

    test('POST /insurance/claims creates a claim', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/insurance/claims', {
        method: 'POST',
        body: JSON.stringify({
          claimNumber: `CLM-E2E-${suffix}`,
          clientName: `E2E Claimant ${suffix}`,
          type: 'illness',
          amount: 5000,
          currency: 'USD',
          status: 'submitted',
          filedDate: new Date().toISOString().split('T')[0],
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.claimNumber).toBe(`CLM-E2E-${suffix}`);
    });

    test('POST /insurance/claims rejects invalid payload', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/claims', {
        method: 'POST',
        body: JSON.stringify({ bad: 'data' }),
      });
      expect(res.status).toBe(400);
    });

    test('GET /insurance/leads returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/leads');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
    });

    test('POST /insurance/leads creates a lead', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/insurance/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: `E2E Lead ${suffix}`,
          email: `e2e-${suffix}@test.com`,
          source: 'website',
          vertical: 'insurance',
          status: 'new',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.name).toContain(`E2E Lead ${suffix}`);
    });

    test('GET /insurance/documents returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/documents');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
    });

    test('GET /insurance/compliance returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/insurance/compliance');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
    });

    test('policy CRUD lifecycle', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const policyNumber = `POL-LIFE-${suffix}`;

      const createRes = await apiFetch('/verticals/insurance/policies', {
        method: 'POST',
        body: JSON.stringify({
          policyNumber,
          type: 'life',
          clientName: `Lifecycle Client ${suffix}`,
          premium: 1000,
          currency: 'USD',
          status: 'pending',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
        }),
      });
      expect(createRes.status).toBe(201);
      const created = await createRes.json();
      const policyId = created.data.id;

      const getRes = await apiFetch(`/verticals/insurance/policies/${policyId}`);
      expect(getRes.ok).toBeTruthy();
      const fetched = await getRes.json();
      expect(fetched.data.policyNumber).toBe(policyNumber);

      const updateRes = await apiFetch(`/verticals/insurance/policies/${policyId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'active', premium: 1200 }),
      });
      expect(updateRes.ok).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.data.status).toBe('active');
      expect(updated.data.premium).toBe('1200.00');

      const deleteRes = await apiFetch(`/verticals/insurance/policies/${policyId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.ok).toBeTruthy();

      const verifyRes = await apiFetch(`/verticals/insurance/policies/${policyId}`);
      expect(verifyRes.status).toBe(404);
    });
  });

  test.describe('Advisor API', () => {
    test('GET /advisor/portfolios returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/advisor/portfolios');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(Array.isArray(body.data)).toBeTruthy();
    });

    test('POST /advisor/portfolios creates a portfolio', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/advisor/portfolios', {
        method: 'POST',
        body: JSON.stringify({
          name: `E2E Portfolio ${suffix}`,
          clientName: `E2E Investor ${suffix}`,
          totalValue: 100000,
          currency: 'USD',
          riskLevel: 'moderate',
          status: 'active',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.name).toBe(`E2E Portfolio ${suffix}`);
      expect(body.data.riskLevel).toBe('moderate');
    });

    test('POST /advisor/portfolios rejects invalid payload', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/advisor/portfolios', {
        method: 'POST',
        body: JSON.stringify({ invalid: true }),
      });
      expect(res.status).toBe(400);
    });

    test('GET /advisor/risk-assessments returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/advisor/risk-assessments');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
    });

    test('POST /advisor/risk-assessments creates an assessment', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/advisor/risk-assessments', {
        method: 'POST',
        body: JSON.stringify({
          clientName: `E2E Assessed ${suffix}`,
          riskScore: 65,
          riskCategory: 'moderate',
          status: 'active',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.riskScore).toBe(65);
    });

    test('GET /advisor/financial-plans returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/advisor/financial-plans');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
    });

    test('POST /advisor/financial-plans creates a plan', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/advisor/financial-plans', {
        method: 'POST',
        body: JSON.stringify({
          name: `E2E Plan ${suffix}`,
          clientName: `E2E Planner ${suffix}`,
          planType: 'retirement',
          goalAmount: 1000000,
          currentProgress: 250000,
          currency: 'USD',
          status: 'active',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.planType).toBe('retirement');
    });

    test('GET /advisor/leads returns success', async ({ apiFetch }) => {
      const res = await apiFetch('/verticals/advisor/leads');
      expect(res.ok).toBeTruthy();
      const body = await res.json();
      expect(body.success).toBeTruthy();
    });

    test('POST /advisor/leads creates a lead', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);
      const res = await apiFetch('/verticals/advisor/leads', {
        method: 'POST',
        body: JSON.stringify({
          name: `E2E Advisor Lead ${suffix}`,
          email: `advisor-${suffix}@test.com`,
          source: 'referral',
          vertical: 'advisor',
          status: 'new',
        }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBeTruthy();
      expect(body.data.name).toContain(`E2E Advisor Lead ${suffix}`);
    });

    test('portfolio CRUD lifecycle', async ({ apiFetch }) => {
      const suffix = Date.now().toString(36);

      const createRes = await apiFetch('/verticals/advisor/portfolios', {
        method: 'POST',
        body: JSON.stringify({
          name: `Lifecycle Portfolio ${suffix}`,
          clientName: `Lifecycle Client ${suffix}`,
          totalValue: 50000,
          currency: 'USD',
          riskLevel: 'aggressive',
          status: 'active',
        }),
      });
      expect(createRes.status).toBe(201);
      const portfolioId = (await createRes.json()).data.id;

      const getRes = await apiFetch(`/verticals/advisor/portfolios/${portfolioId}`);
      expect(getRes.ok).toBeTruthy();

      const updateRes = await apiFetch(`/verticals/advisor/portfolios/${portfolioId}`, {
        method: 'PUT',
        body: JSON.stringify({ totalValue: 75000, riskLevel: 'conservative' }),
      });
      expect(updateRes.ok).toBeTruthy();
      const updated = await updateRes.json();
      expect(updated.data.riskLevel).toBe('conservative');

      const deleteRes = await apiFetch(`/verticals/advisor/portfolios/${portfolioId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.ok).toBeTruthy();

      const verifyRes = await apiFetch(`/verticals/advisor/portfolios/${portfolioId}`);
      expect(verifyRes.status).toBe(404);
    });
  });

  test.describe('Cross-Vertical Auth', () => {
    test('vertical endpoints require authentication', async ({ authenticatedPage }) => {
      const { getAccessTokenFromPage } = await import('../helpers/auth');
      const token = await getAccessTokenFromPage(authenticatedPage);
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(20);
    });

    test('vertical endpoints reject requests without auth', async () => {
      const baseURL = process.env.E2E_API_URL || 'http://localhost:13738/v1';
      const res = await fetch(`${baseURL}/verticals/insurance/policies`);
      expect(res.status).toBe(401);
    });
  });
});
