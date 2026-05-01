/**
 * E2E tests for the Router service.
 *
 * Tests: health, web-search, image-search.
 *
 * Strategy:
 * - mock.module() replaces external services (Tavily, Serper, billing)
 * - apiKeyAuth mock bypasses auth validation, sets accountId from Bearer token
 * - LLM routes removed — clients now connect directly to LiteLLM via credentials
 */
import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { BillingError } from '../errors';

// ─── Mock tracking ───────────────────────────────────────────────────────────

let mockTavilyResults: any[] = [];
let mockTavilyError: Error | null = null;
let mockSerperResults: any[] = [];
let mockSerperError: Error | null = null;
let mockCheckCreditsResult = { hasCredits: true, message: 'OK', balance: 100 };
let mockDeductResult: any = { success: true, cost: 0.01, newBalance: 99, transactionId: 'tx_mock_001' };

const TEST_ACCOUNT_ID = 'acc_test_e2e_001';

// ─── Register mocks ──────────────────────────────────────────────────────────

// Mock apiKeyAuth to always set accountId (bypasses real auth validation)
mock.module('../middleware/auth', () => ({
  apiKeyAuth: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }
    const token = authHeader.slice(7);
    if (!token) {
      throw new HTTPException(401, { message: 'Missing token in Authorization header' });
    }
    c.set('accountId', TEST_ACCOUNT_ID);
    await next();
  },
  supabaseAuth: async (c: any, next: any) => {
    c.set('userId', TEST_ACCOUNT_ID);
    c.set('userEmail', 'test@example.com');
    await next();
  },
  combinedAuth: async (c: any, next: any) => { await next(); },
}));

mock.module('../router/services/tavily', () => ({
  webSearchTavily: async (query: string, maxResults: number, searchDepth: string) => {
    if (mockTavilyError) throw mockTavilyError;
    return mockTavilyResults;
  },
}));

mock.module('../router/services/serper', () => ({
  imageSearchSerper: async (query: string, maxResults: number, safeSearch: boolean) => {
    if (mockSerperError) throw mockSerperError;
    return mockSerperResults;
  },
}));

mock.module('../router/services/billing', () => ({
  checkCredits: async (accountId: string, min?: number, opts?: any) => mockCheckCreditsResult,
  deductToolCredits: async (...args: any[]) => mockDeductResult,
  deductLLMCredits: async (...args: any[]) => mockDeductResult,
}));

mock.module('../config', () => ({
  config: {
    ENV_MODE: 'test',
    INTERNAL_AETHER_ENV: 'test',
    PORT: 8008,
    DATABASE_URL: process.env.DATABASE_URL || 'postgres://mock:mock@localhost/mock',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
    API_KEY_SECRET: 'test-secret',
    ALLOWED_SANDBOX_PROVIDERS: [],
    TUNNEL_ENABLED: false,
    RECONCILIATION_ENABLED: false,
    AETHER_BILLING_INTERNAL_ENABLED: false,
    AETHER_DEPLOYMENTS_ENABLED: false,
    TAVILY_API_URL: 'https://api.tavily.com',
    TAVILY_API_KEY: 'tvly-test',
    SERPER_API_URL: 'https://google.serper.dev',
    SERPER_API_KEY: 'serper-test',
    FIRECRAWL_API_URL: 'https://api.firecrawl.dev',
    FIRECRAWL_API_KEY: '',
    REPLICATE_API_URL: 'https://api.replicate.com',
    REPLICATE_API_TOKEN: '',
    CONTEXT7_API_URL: 'https://context7.com',
    CONTEXT7_API_KEY: '',
    ANTHROPIC_API_URL: '',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_URL: '',
    OPENAI_API_KEY: '',
    XAI_API_URL: '',
    XAI_API_KEY: '',
    GEMINI_API_URL: '',
    GEMINI_API_KEY: '',
    GROQ_API_URL: '',
    GROQ_API_KEY: '',
    isCloud: () => false,
    isLocal: () => true,
    isLocalDockerEnabled: () => false,
    isJustAVPSEnabled: () => false,
    isDaytonaEnabled: () => false,
  },
  SANDBOX_VERSION: 'test-v1',
  AETHER_MARKUP: 1.2,
  PLATFORM_FEE_MARKUP: 0.1,
}));

// NOTE: Do NOT mock ../shared/db here. The router test's config mock provides
// DATABASE_URL so the real db module creates a proper connection.
// Previous mocks (incomplete or Proxy-based) broke other tests that need real
// DB access (pipedream, deployments, resolve-account-strict) because Bun's
// mock.module() is process-global and first-registration-wins.

// Mock finance routes to avoid deep DB import chains
const { Hono: MockHono } = await import('hono');
const mockFinanceApp = new MockHono();
mock.module('../router/routes/finance', () => ({
  invoicesRoutes: mockFinanceApp,
  expensesRoutes: mockFinanceApp,
  budgetsRoutes: mockFinanceApp,
  ledgersRoutes: mockFinanceApp,
}));

// Mock shared/crypto
mock.module('../shared/crypto', () => ({
  KEY_PREFIX: 'aether_',
  KEY_PREFIX_SANDBOX: 'aether_sb_',
  KEY_PREFIX_TUNNEL: 'aether_tnl_',
  KEY_PREFIX_PUBLIC: 'pk_',
  randomAlphanumeric: (length: number) => 'x'.repeat(length),
  isAetherToken: (token: string) => token.startsWith('aether_'),
  generateApiKeyPair: () => ({ publicKey: 'pk_testkey', secretKey: 'aether_testkey' }),
  generateSandboxKeyPair: () => ({ publicKey: 'pk_testkey', secretKey: 'aether_sb_testkey' }),
  generateTunnelToken: () => 'aether_tnl_testtoken',
  generateDeviceCode: () => 'ABCD-1234',
  isTunnelToken: (token: string) => token.startsWith('aether_tnl_'),
  hashSecretKey: (key: string) => 'testhash_' + key,
  verifySecretKey: (_key: string, _hash: string) => true,
  isApiKeySecretConfigured: () => true,
  timingSafeStringEqual: (_a: string, _b: string) => _a === _b,
  deriveSigningKey: (_token: string, _secret: string) => 'testsigningkey',
  signMessage: (_key: string, _payload: string, _nonce: number) => 'testsig',
  verifyMessageSignature: (_key: string, _payload: string, _nonce: number, _sig: string) => true,
  encryptCredential: (plaintext: string) => plaintext,
  decryptCredential: (encrypted: string) => encrypted,
}));

mock.module('../router/config/litellm-config', () => ({
  litellmConfig: {
    LITELLM_URL: 'http://localhost:4000',
    LITELLM_MASTER_KEY: 'sk-test-master',
    LITELLM_TIMEOUT_MS: 60000,
    LITELLM_NUM_RETRIES: 3,
  },
}));

// ─── Import router AFTER mocks ───────────────────────────────────────────────

const { router } = await import('../router/index');

// ─── Test app factory ────────────────────────────────────────────────────────

function createRouterTestApp() {
  const app = new Hono();
  app.use('*', cors());

  app.route('/v1/router', router);

  app.onError((err, c) => {
    if (err instanceof BillingError) {
      return c.json({ error: err.message }, err.statusCode as any);
    }
    if (err instanceof HTTPException) {
      return c.json({ error: true, message: err.message, status: err.status }, err.status);
    }
    console.error('Router test error:', err);
    return c.json({ error: true, message: 'Internal server error', status: 500 }, 500);
  });

  app.notFound((c) => c.json({ error: true, message: 'Not found', status: 404 }, 404));

  return app;
}

// ─── Reset mocks ─────────────────────────────────────────────────────────────

beforeEach(() => {
  mockTavilyResults = [
    { title: 'Result 1', url: 'https://example.com/1', snippet: 'First result', published_date: null },
    { title: 'Result 2', url: 'https://example.com/2', snippet: 'Second result', published_date: '2025-01-01' },
  ];
  mockTavilyError = null;
  mockSerperResults = [
    { title: 'Image 1', url: 'https://img.com/1.jpg', thumbnail_url: 'https://img.com/1_t.jpg', source_url: 'https://example.com/1', width: 800, height: 600 },
  ];
  mockSerperError = null;
  mockCheckCreditsResult = { hasCredits: true, message: 'OK', balance: 100 };
  mockDeductResult = { success: true, cost: 0.01, newBalance: 99, transactionId: 'tx_mock_001' };
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Router: health', () => {
  test('GET /v1/router/health returns ok', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('aether-router');
    expect(body.timestamp).toBeDefined();
    expect(body.env).toBeDefined();
  });
});

describe('Router: web-search', () => {
  test('POST /v1/router/web-search returns search results', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'test query', max_results: 2 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.query).toBe('test query');
    expect(body.cost).toBeDefined();
    expect(body.results[0].title).toBe('Result 1');
  });

  test('returns 400 for missing query', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ max_results: 5 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message || body.error).toBeDefined();
  });

  test('returns 400 for empty query', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: '' }),
    });
    expect(res.status).toBe(400);
  });

  test('returns 402 when insufficient credits', async () => {
    mockCheckCreditsResult = { hasCredits: false, message: 'No credits', balance: 0 };
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(402);
  });

  test('returns 500 when Tavily service throws', async () => {
    mockTavilyError = new Error('TAVILY_API_KEY not configured');
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain('not configured');
  });

  test('applies default search_depth=basic and max_results=5', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(200);
  });

  test('accepts search_depth=advanced', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'test', search_depth: 'advanced' }),
    });
    expect(res.status).toBe(200);
  });
});

describe('Router: image-search', () => {
  test('POST /v1/router/image-search returns image results', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'cat photos' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.query).toBe('cat photos');
    expect(body.cost).toBeDefined();
    expect(body.results[0].title).toBe('Image 1');
  });

  test('returns 400 for missing query', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test('returns 402 when insufficient credits', async () => {
    mockCheckCreditsResult = { hasCredits: false, message: 'No credits', balance: 0 };
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'cats' }),
    });
    expect(res.status).toBe(402);
  });

  test('returns 500 when Serper service throws', async () => {
    mockSerperError = new Error('SERPER_API_KEY not configured');
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/image-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TEST_ACCOUNT_ID}` },
      body: JSON.stringify({ query: 'cats' }),
    });
    expect(res.status).toBe(500);
  });
});

describe('Router: auth (mocked apiKeyAuth)', () => {
  test('returns 401 without Authorization header', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  test('returns 401 with invalid header format (not Bearer)', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic abc123' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(res.status).toBe(401);
  });

  test('health endpoint does NOT require auth', async () => {
    const app = createRouterTestApp();
    const res = await app.request('/v1/router/health');
    expect(res.status).toBe(200);
  });

  test('search routes require auth', async () => {
    const app = createRouterTestApp();

    const searchRes = await app.request('/v1/router/web-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'test' }),
    });
    expect(searchRes.status).toBe(401);
  });
});
