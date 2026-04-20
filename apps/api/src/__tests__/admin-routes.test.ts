/**
 * Admin route tests — tests the extracted route modules directly.
 *
 * All imports are via require() after mock.module() calls, because Bun hoists
 * import statements above mock.module() calls, which means config.ts loads
 * before our mock and calls process.exit(1) on missing env vars.
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ─── Mocks (MUST be before any require() calls) ─────────────────────────────

mock.module('../config', () => ({
  config: {
    ENV_MODE: 'test',
    INTERNAL_AETHER_ENV: 'test',
    PORT: 8008,
    SANDBOX_VERSION: 'test',
    ALLOWED_SANDBOX_PROVIDERS: [],
    AETHER_BILLING_INTERNAL_ENABLED: false,
    isDaytonaEnabled: () => false,
    isLocalDockerEnabled: () => false,
    isJustAVPSEnabled: () => false,
    isLocal: () => false,
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    STRIPE_SECRET_KEY: '',
    SANDBOX_PORT_BASE: 14000,
    SANDBOX_CONTAINER_NAME: 'aether-sandbox',
    AETHER_URL: 'http://localhost:8008/v1/router',
    JUSTAVPS_API_URL: '',
    JUSTAVPS_API_KEY: '',
  },
  SANDBOX_VERSION: 'test',
}));

mock.module('../middleware/tenant-config-loader', () => ({
  tenantConfigLoader: async (_c: any, next: any) => { await next(); },
  invalidateTenantCache: mock(() => {}),
  getCacheMetrics: () => ({ hits: 0, misses: 0, evictions: 0, expirations: 0, size: 0 }),
}));

// ─── In-memory feature flag store ───────────────────────────────────────────

const featureFlagStore = new Map<string, any>();
let flagIdCounter = 1;

function resetStore() {
  featureFlagStore.clear();
  flagIdCounter = 1;
}

mock.module('../shared/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: async () => Array.from(featureFlagStore.values()),
          limit: async () => {
            if (featureFlagStore.size > 0) {
              const entries = Array.from(featureFlagStore.entries());
              return [{ ...entries[0][1], id: entries[0][0] }];
            }
            return [];
          },
        }),
      }),
    }),
    insert: () => ({
      values: (data: any) => ({
        returning: async () => {
          const id = `flag-${flagIdCounter++}`;
          const flag = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          featureFlagStore.set(id, flag);
          return [flag];
        },
      }),
    }),
    update: () => ({
      set: (data: any) => ({
        where: () => ({
          returning: async () => {
            for (const [id, flag] of featureFlagStore) {
              const updated = { ...flag, ...data, updatedAt: new Date() };
              featureFlagStore.set(id, updated);
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
  accounts: { accountId: 'accountId', name: 'name' },
}));

mock.module('../providers/registry', () => ({
  buildProviderKeySchema: () => ({
    llm: { title: 'LLM', description: 'LLM keys', keys: [{ key: 'OPENAI_API_KEY', label: 'OpenAI', secret: true }] },
  }),
  ALL_SANDBOX_ENV_KEYS: new Set(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY']),
  PROVIDER_REGISTRY: {},
  LLM_PROVIDERS: [],
  TOOL_PROVIDERS: [],
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
    resetStore();
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
