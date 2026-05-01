/**
 * Admin route tests — tests the extracted route modules directly.
 *
 * All imports are via require() after mock.module() calls, because Bun hoists
 * import statements above mock.module() calls, which means config.ts loads
 * before our mock and calls process.exit(1) on missing env vars.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { createTestConfig } from './billing/mocks';
import { dbMockState, resetDbMockState } from './db-mock-state';

// ─── Mocks (MUST be before any require() calls) ─────────────────────────────

mock.module('../config', () => ({
  config: createTestConfig({
    ALLOWED_SANDBOX_PROVIDERS: [],
    AETHER_BILLING_INTERNAL_ENABLED: false,
    isLocalDockerEnabled: () => false,
  }),
  SANDBOX_VERSION: 'test',
}));

mock.module('../middleware/tenant-config-loader', () => ({
  tenantConfigLoader: async (_c: any, next: any) => { await next(); },
  invalidateTenantCache: mock(() => {}),
  getCacheMetrics: () => ({ hits: 0, misses: 0, evictions: 0, expirations: 0, size: 0 }),
}));

// Combined ../shared/db mock — handles BOTH feature flag queries (admin routes)
// AND account resolution queries (resolve-account-strict).
mock.module('../shared/db', () => ({
  get hasDatabase() { return dbMockState.hasDatabase; },
  db: {
    select: (shape?: Record<string, unknown>) => ({
      from: (table?: { __name?: string } & Record<string, unknown>) => ({
        where: (_clause?: unknown) => {
          const isAccountQuery = shape && ('tier' in shape || 'email' in shape || 'accountId' in shape);
          return {
            orderBy: async () => Array.from(dbMockState.featureFlags.values()),
            limit: async (_n?: number) => {
              if (isAccountQuery && shape) {
                if ('tier' in shape) {
                  return dbMockState.creditAccountsTier ? [{ tier: dbMockState.creditAccountsTier }] : [];
                }
                if ('email' in shape) {
                  return dbMockState.customerEmail ? [{ email: dbMockState.customerEmail }] : [];
                }
                if ('accountId' in shape && table) {
                  const tableName = String(table.__name || '');
                  if (tableName.includes('account_members')) {
                    return dbMockState.memberAccountId ? [{ accountId: dbMockState.memberAccountId }] : [];
                  }
                  if (tableName.includes('account_user')) {
                    return dbMockState.legacyAccountId ? [{ accountId: dbMockState.legacyAccountId }] : [];
                  }
                }
                return [];
              }
              // Feature flag path
              if (dbMockState.featureFlags.size > 0) {
                const entries = Array.from(dbMockState.featureFlags.entries());
                return [{ ...entries[0][1], id: entries[0][0] }];
              }
              return [];
            },
          };
        },
      }),
    }),
    insert: (table?: { __name?: string } & Record<string, unknown>) => ({
      values: (data: any) => ({
        returning: async () => {
          const id = `flag-${dbMockState.flagIdCounter++}`;
          const flag = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          dbMockState.featureFlags.set(id, flag);
          return [flag];
        },
        onConflictDoNothing: async () => {
          const tableName = String(table?.__name || '');
          if (tableName.includes('accounts')) {
            dbMockState.accountsInsertCalls += 1;
          }
          if (tableName.includes('account_members')) {
            dbMockState.accountMembersInsertCalls += 1;
          }
        },
      }),
    }),
    update: () => ({
      set: (data: any) => ({
        where: () => ({
          returning: async () => {
            for (const [id, flag] of dbMockState.featureFlags) {
              const updated = { ...flag, ...data, updatedAt: new Date() };
              dbMockState.featureFlags.set(id, updated);
              return [updated];
            }
            return [];
          },
        }),
      }),
    }),
    delete: () => ({
      where: async () => {},
    }),
  },
}));

mock.module('@aether/db', () => ({
  featureFlags: {
    id: 'id', accountId: 'accountId', verticalId: 'verticalId',
    featureName: 'featureName', enabled: 'enabled', config: 'config',
    createdAt: 'createdAt', updatedAt: 'updatedAt',
  },
  sandboxes: {
    sandboxId: 'sandboxId', externalId: 'externalId', name: 'name',
    provider: 'provider', baseUrl: 'baseUrl', status: 'status',
    metadata: 'metadata', createdAt: 'createdAt', updatedAt: 'updatedAt',
    lastUsedAt: 'lastUsedAt', accountId: 'accountId',
  },
  accounts: { accountId: 'accountId', name: 'name', __name: 'aether.accounts' },
  platformUserRoles: {
    id: 'id', accountId: 'accountId', userId: 'userId',
    role: 'role', createdAt: 'createdAt',
  },
  accountMembers: {
    userId: 'account_members.user_id',
    accountId: 'account_members.account_id',
    accountRole: 'account_members.account_role',
    __name: 'aether.account_members',
  },
  accountUser: {
    userId: 'account_user.user_id',
    accountId: 'account_user.account_id',
    __name: 'basejump.account_user',
  },
  billingCustomers: {
    accountId: 'billing_customers.account_id',
    email: 'billing_customers.email',
    __name: 'aether.billing_customers',
  },
  creditAccounts: {
    accountId: 'credit_accounts.account_id',
    tier: 'credit_accounts.tier',
    __name: 'aether.credit_accounts',
  },
  creditLedger: { id: 'id', accountId: 'accountId', amount: 'amount', type: 'type' },
  creditUsage: { id: 'id', accountId: 'accountId', amount: 'amount' },
  creditPurchases: { id: 'id', accountId: 'accountId', amount: 'amount' },
  accountDeletionRequests: { id: 'id', accountId: 'accountId', status: 'status' },
}));

// ─── Require after mocks ────────────────────────────────────────────────────

const { Hono } = require('hono');
const { envRoutes } = require('../admin/routes/env');
const { featureFlagsRoutes } = require('../admin/routes/feature-flags');

function createAdminTestApp() {
  const app = new Hono();
  app.route('/', envRoutes);
  app.route('/', featureFlagsRoutes);
  return app;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Admin Routes', () => {
  beforeEach(() => {
    resetDbMockState();
  });

  describe('Feature Flags', () => {
    test('GET /api/feature-flags returns empty array when no flags exist', async () => {
      const app = createAdminTestApp();
      const res = await app.request('/api/feature-flags');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    test('POST /api/feature-flags creates a new flag', async () => {
      const app = createAdminTestApp();
      const res = await app.request('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc-123',
          verticalId: 'finance',
          featureName: 'advanced_analytics',
          enabled: true,
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.accountId).toBe('acc-123');
      expect(body.data.verticalId).toBe('finance');
      expect(body.data.featureName).toBe('advanced_analytics');
      expect(body.data.enabled).toBe(true);
    });

    test('POST /api/feature-flags rejects missing required fields', async () => {
      const app = createAdminTestApp();
      const res = await app.request('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: 'acc-123' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('required');
    });

    test('POST /api/feature-flags defaults enabled to false', async () => {
      const app = createAdminTestApp();
      const res = await app.request('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc-456',
          verticalId: 'default',
          featureName: 'new_feature',
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.enabled).toBe(false);
    });

    test('DELETE /api/feature-flags/:id returns 404 for non-existent flag', async () => {
      const app = createAdminTestApp();
      const res = await app.request('/api/feature-flags/nonexistent', {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('not found');
    });

    test('GET /api/feature-flags supports accountId filter', async () => {
      const app = createAdminTestApp();
      await app.request('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acc-filter-test',
          verticalId: 'default',
          featureName: 'filtered_feature',
          enabled: true,
        }),
      });
      const res = await app.request('/api/feature-flags?accountId=acc-filter-test');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Schema', () => {
    test('GET /api/schema returns key schema with expected groups', async () => {
      const app = createAdminTestApp();
      const res = await app.request('/api/schema');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.billing).toBeDefined();
      expect(body.core).toBeDefined();
      expect(body.billing.title).toBe('Billing');
      expect(body.billing.keys.length).toBeGreaterThan(0);
      expect(body.core.title).toBe('Core Infrastructure');
    });
  });
});
