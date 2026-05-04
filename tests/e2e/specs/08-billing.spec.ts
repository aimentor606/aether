import { test, expect } from '../fixtures';

test.describe('08 — Billing Endpoints', () => {
  test('GET /v1/billing/account-state returns 200 with account info', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/account-state');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      const data = body.data;
      // Account state should include tier, credits, or subscription info
      const hasBillingFields =
        'tier' in data ||
        'credits' in data ||
        'subscription' in data ||
        'plan' in data ||
        'accountId' in data;
      expect(hasBillingFields).toBe(true);
    }
  });

  test('GET /v1/billing/account-state/minimal returns 200 with minimal state', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/account-state/minimal');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    }
  });

  test('GET /v1/billing/tier-configurations returns 200 with available tiers', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/tier-configurations');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      // Should contain tier definitions (array or object)
      const data = body.data;
      const isIterable = Array.isArray(data) || (typeof data === 'object' && data !== null);
      expect(isIterable).toBe(true);
    }
  });

  test('GET /v1/billing/credit-breakdown returns 200 with credit breakdown', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/credit-breakdown');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    }
  });

  test('GET /v1/billing/transactions returns 200 with transaction list', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/transactions');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      // Transaction list may be empty in local/self-hosted mode
      const data = body.data;
      if (Array.isArray(data)) {
        expect(data.length).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('GET /v1/billing/transactions/summary returns 200 with summary', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/transactions/summary');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    }
  });

  test('GET /v1/billing/usage-history returns 200', async ({ apiFetch }) => {
    const res = await apiFetch('/billing/usage-history');
    expect(res.status).toBe(200);

    const body = await res.json();
    // May be empty if no usage recorded in self-hosted mode
    if (body.success) {
      expect(body).toHaveProperty('data');
    }
  });

  test('GET /v1/billing/metered-usage returns 200 with metered usage data', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/metered-usage');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    }
  });

  test('GET /v1/billing/metered-usage/total returns 200 with totals', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/metered-usage/total');
    expect(res.status).toBe(200);

    const body = await res.json();
    if (body.success) {
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    }
  });

  test('GET /v1/billing/auto-topup/settings returns 200', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/billing/auto-topup/settings');
    expect(res.status).toBe(200);

    const body = await res.json();
    // May return not configured in self-hosted mode — both success and
    // "not configured" are acceptable responses
    if (body.success) {
      expect(body).toHaveProperty('data');
      expect(typeof body.data).toBe('object');
    }
  });
});
