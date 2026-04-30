import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { mockRegistry, registerGlobalMocks } from './billing/mocks';

const TEST_ACCOUNT_ID = 'test-account-123';

let mockResolveVirtualKey: (accountId: string) => Promise<string>;
let mockSyncKeyBudget: (accountId: string, budgetUsd: number) => Promise<void>;

mock.module('../config', () => ({
  config: {
    ENV_MODE: 'test',
    INTERNAL_AETHER_ENV: 'test',
    PORT: 8008,
    DATABASE_URL: 'postgres://mock:mock@localhost/mock',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    API_KEY_SECRET: 'test-secret',
    ALLOWED_SANDBOX_PROVIDERS: [],
    TUNNEL_ENABLED: false,
    RECONCILIATION_ENABLED: false,
    AETHER_BILLING_INTERNAL_ENABLED: false,
    AETHER_DEPLOYMENTS_ENABLED: false,
  },
  SANDBOX_VERSION: 'test-v1',
}));

mock.module('../middleware/auth', () => ({
  apiKeyAuth: async (_c: any, next: any) => {
    throw new Error('Unexpected apiKeyAuth call');
  },
  supabaseAuth: async (_c: any, next: any) => { await next(); },
  combinedAuth: async (c: any, next: any) => {
    c.set('accountId', TEST_ACCOUNT_ID);
    c.set('userId', 'user-123');
    c.set('userEmail', 'test@aether.dev');
    await next();
  },
}));

mock.module('../router/services/litellm-keys', () => ({
  resolveVirtualKey: (...args: [string]) => mockResolveVirtualKey(...args),
  syncKeyBudget: (...args: [string, number]) => mockSyncKeyBudget(...args),
}));

mock.module('../router/config/litellm-config', () => ({
  litellmConfig: {
    LITELLM_URL: 'http://litellm:4000',
    LITELLM_PUBLIC_URL: 'https://llm.aether.dev',
    LITELLM_MASTER_KEY: 'sk-test-master',
    LITELLM_TIMEOUT_MS: 60000,
    LITELLM_NUM_RETRIES: 3,
  },
}));

// Register billing dependency mocks (supabase, repos) so the real credits
// service works with mocked deps. Idempotent — no-op if billing tests already
// registered these mocks (first-registration-wins for overlapping paths like
// config, where our mock above takes priority).
registerGlobalMocks();

const { credentialsApp } = await import('../router/routes/credentials');

function createTestApp() {
  const app = new Hono();
  app.use('/v1/control/*', async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    (c as any).set('accountId', TEST_ACCOUNT_ID);
    await next();
  });
  app.route('/v1/control', credentialsApp);
  return app;
}

describe('GET /v1/control/credentials', () => {
  beforeEach(() => {
    mockResolveVirtualKey = async () => 'sk-virtual-test-key';
    mockSyncKeyBudget = async () => {};
    mockRegistry.getCreditBalance = async () => ({
      balance: '50', expiringCredits: '0', nonExpiringCredits: '50', dailyCreditsBalance: '0', tier: 'free',
    });
  });

  test('happy path — returns credentials', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/control/credentials', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.litellm_url).toBe('https://llm.aether.dev');
    expect(body.data.api_key).toBe('sk-virtual-test-key');
    expect(body.data.key_alias).toBe('aether-test-account-123');
  });

  test('syncs budget with current balance', async () => {
    let syncedBudget = 0;
    mockSyncKeyBudget = async (_id: string, budget: number) => { syncedBudget = budget; };
    mockRegistry.getCreditBalance = async () => ({
      balance: '25.5', expiringCredits: '5', nonExpiringCredits: '20.5', dailyCreditsBalance: '0', tier: 'free',
    });

    const app = createTestApp();
    await app.request('/v1/control/credentials', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(syncedBudget).toBe(25.5);
  });

  test('unauthorized — no auth header', async () => {
    const app = createTestApp();
    const res = await app.request('/v1/control/credentials');
    expect(res.status).toBe(401);
  });

  test('LiteLLM unreachable — returns 502', async () => {
    mockResolveVirtualKey = async () => { throw new Error('LiteLLM connection refused'); };
    const app = createTestApp();
    const res = await app.request('/v1/control/credentials', {
      headers: { Authorization: 'Bearer test-token' },
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('unavailable');
  });
});
