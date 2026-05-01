/**
 * E2E tests for Billing HTTP routes.
 *
 * Tests: tier-configurations, credit-breakdown, deduct, deduct-usage,
 *        account deletion (status, request, cancel, delete-immediately).
 *
 * Strategy:
 * - billing/mocks.ts provides centralized mocks for config, supabase, stripe, repos
 * - This file adds auth mock + wires mockRegistry for route-level behavior
 * - Real service layer runs on mocked repos
 */
import { describe, test, expect, beforeEach, beforeAll, mock } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { BillingError, InsufficientCreditsError } from '../errors';
import { registerGlobalMocks, mockRegistry } from './billing/mocks';

registerGlobalMocks();

// ─── Mock state ──────────────────────────────────────────────────────────────

const TEST_USER_ID = '00000000-0000-4000-a000-000000000001';

let mockCreditBalance: any = {
  balance: '100.0000',
  expiringCredits: '80.0000',
  nonExpiringCredits: '20.0000',
  dailyCreditsBalance: '3.00',
  tier: 'tier_6_50',
};
let mockDeductResult: any = { success: true, cost: 0.5, newBalance: 99.5, transactionId: 'tx_test_001' };
let mockDeductError: Error | null = null;
let mockTransactionsSummary: any = { totalCredits: 150, totalDebits: 50, count: 200 };

let mockActiveDeletionRequest: any = null;

// ─── Auth mock ───────────────────────────────────────────────────────────────

mock.module('../middleware/auth', () => ({
  supabaseAuth: async (c: any, next: any) => {
    c.set('userId', TEST_USER_ID);
    c.set('userEmail', 'test@example.com');
    await next();
  },
}));

// ─── Lazy import ─────────────────────────────────────────────────────────────

let billingApp: any;

async function loadBillingApp() {
  const mod = await import('../billing/index');
  billingApp = mod.billingApp;
}

// ─── Test app factory ────────────────────────────────────────────────────────

function createBillingTestApp() {
  const app = new Hono();

  app.route('/v1/billing', billingApp);

  app.onError((err, c) => {
    if (err instanceof BillingError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: true, message: err.message, status: err.status }, err.status);
    }
    return c.json({ error: true, message: 'Internal server error', status: 500 }, 500);
  });

  app.notFound((c) => c.json({ error: true, message: 'Not found', status: 404 }, 404));

  return app;
}

// ─── Reset ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockCreditBalance = {
    balance: '100.0000',
    expiringCredits: '80.0000',
    nonExpiringCredits: '20.0000',
    dailyCreditsBalance: '3.00',
    tier: 'tier_6_50',
  };
  mockDeductResult = { success: true, cost: 0.5, newBalance: 99.5, transactionId: 'tx_test_001' };
  mockDeductError = null;
  mockTransactionsSummary = { totalCredits: 150, totalDebits: 50, count: 200 };
  mockActiveDeletionRequest = null;

  mockRegistry.getCreditBalance = async () => mockCreditBalance;
  mockRegistry.deductCredits = async () => {
    if (mockDeductError) throw mockDeductError;
    return mockDeductResult;
  };
  mockRegistry.getTransactionsSummary = async () => mockTransactionsSummary;
  mockRegistry.insertLedgerEntry = async () => ({ id: 'ledger_test' });

  // Account deletion repo — real service calls these
  mockRegistry.getActiveDeletionRequest = async () => mockActiveDeletionRequest;
  mockRegistry.createDeletionRequest = async (_accountId: string, _userId: string, scheduledFor: string, reason?: string) => ({
    id: 'del_test_001',
    accountId: _accountId,
    userId: _userId,
    scheduledFor,
    reason: reason ?? null,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  });
  mockRegistry.cancelDeletionRequest = async () => {};
  mockRegistry.markDeletionCompleted = async () => {};
  mockRegistry.updateCreditAccount = async () => {};
  mockRegistry.getCreditAccount = async () => null;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Billing: e2e routes', () => {
  beforeAll(async () => {
    await loadBillingApp();
  });

  describe('Billing: tier-configurations', () => {
    test('GET /v1/billing/tier-configurations returns visible tiers', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/tier-configurations', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tiers).toBeDefined();
      expect(Array.isArray(body.tiers)).toBe(true);
      expect(body.tiers.length).toBeGreaterThanOrEqual(1);

      const tierNames = body.tiers.map((t: any) => t.name);
      expect(tierNames).toContain('free');
      expect(tierNames).not.toContain('none');

      const freeTier = body.tiers.find((t: any) => t.name === 'free');
      expect(freeTier.display_name).toBe('Free');
      expect(freeTier.monthly_price).toBe(0);
      expect(freeTier.monthly_credits).toBe(0);
    });
  });

  describe('Billing: credit-breakdown', () => {
    test('GET /v1/billing/credit-breakdown returns balance breakdown', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/credit-breakdown', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(100);
      expect(body.expiring).toBe(80);
      expect(body.non_expiring).toBe(20);
      expect(body.daily).toBe(3);
    });

    test('returns zeros when no account found', async () => {
      mockCreditBalance = null;
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/credit-breakdown', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(0);
      expect(body.expiring).toBe(0);
      expect(body.non_expiring).toBe(0);
      expect(body.daily).toBe(0);
    });
  });

  describe('Billing: deduct', () => {
    test('POST /v1/billing/deduct deducts credits for token usage', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({
          prompt_tokens: 1000,
          completion_tokens: 500,
          model: 'claude-sonnet-4-5',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.cost).toBeDefined();
      expect(body.new_balance).toBeDefined();
      expect(body.transaction_id).toBe('tx_test_001');
    });

    test('returns success with zero cost when calculated cost is zero', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({
          prompt_tokens: 0,
          completion_tokens: 0,
          model: 'free-model',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.cost).toBe(0);
    });

    test('returns error when deduction fails (insufficient credits)', async () => {
      mockDeductError = new InsufficientCreditsError(0.5, 100);
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({
          prompt_tokens: 10000000,
          completion_tokens: 10000000,
          model: 'claude-sonnet-4-5',
        }),
      });
      expect(res.status).toBe(402);
    });

    test('deducts without thread_id or message_id', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({
          prompt_tokens: 1000,
          completion_tokens: 500,
          model: 'claude-sonnet-4-5',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('Billing: deduct-usage', () => {
    test('POST /v1/billing/deduct-usage deducts a fixed amount', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({ amount: 0.05, description: 'Custom usage' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('returns success with zero cost for zero/negative amount', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({ amount: 0 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.cost).toBe(0);
    });

    test('returns success with zero cost for negative amount', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/deduct-usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({ amount: -5 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.cost).toBe(0);
    });
  });

  describe('Billing: usage-history', () => {
    test('GET /v1/billing/usage-history returns summary', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/usage-history', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.totalCredits).toBe(150);
      expect(body.totalDebits).toBe(50);
      expect(body.count).toBe(200);
    });

    test('accepts days query parameter', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/usage-history?days=7', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
    });
  });

  describe('Billing: account deletion', () => {
    test('GET /v1/billing/account/deletion-status returns no pending deletion', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/deletion-status', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pending).toBe(false);
    });

    test('GET /v1/billing/account/deletion-status returns pending deletion', async () => {
      mockActiveDeletionRequest = {
        id: 'del_test_001',
        accountId: TEST_USER_ID,
        status: 'pending',
        scheduledFor: '2026-03-01T00:00:00.000Z',
        requestedAt: '2026-02-15T00:00:00.000Z',
        reason: 'No longer needed',
      };
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/deletion-status', {
        method: 'GET',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pending).toBe(true);
      expect(body.can_cancel).toBe(true);
      expect(body.scheduled_for).toBeDefined();
    });

    test('POST /v1/billing/account/request-deletion creates deletion request', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({ reason: 'Testing deletion' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBeDefined();
      expect(body.scheduled_for).toBeDefined();
      expect(body.can_cancel).toBe(true);
      expect(body.grace_period_days).toBe(14);
    });

    test('POST /v1/billing/account/request-deletion works without reason', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
    });

    test('POST /v1/billing/account/request-deletion returns error when already pending', async () => {
      mockActiveDeletionRequest = {
        id: 'del_existing',
        accountId: TEST_USER_ID,
        status: 'pending',
      };
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/request-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    test('POST /v1/billing/account/cancel-deletion cancels pending deletion', async () => {
      mockActiveDeletionRequest = {
        id: 'del_test_001',
        accountId: TEST_USER_ID,
        status: 'pending',
      };
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/cancel-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    test('POST /v1/billing/account/cancel-deletion returns error when nothing to cancel', async () => {
      // mockActiveDeletionRequest is already null from beforeEach
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/cancel-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(400);
    });

    test('DELETE /v1/billing/account/delete-immediately deletes account', async () => {
      const app = createBillingTestApp();
      const res = await app.request('/v1/billing/account/delete-immediately', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test_token' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('Account deleted');
    });
  });
});
