/**
 * Unit tests for sandbox secret provisioning (Unit 4).
 *
 * Verifies that env-injector injects direct upstream URLs and API keys
 * instead of proxy URLs, and resolves LiteLLM virtual keys per account.
 */
import { describe, it, expect, beforeEach, mock } from 'bun:test';

const TEST_LITELLM_KEY = 'sk-litellm-virtual-test-key';

// ─── Register mocks before any real imports ──────────────────────────────────

mock.module('../config', () => ({
  config: {
    ENV_MODE: 'test',
    INTERNAL_AETHER_ENV: 'test',
    PORT: 8008,
    AETHER_URL: 'http://localhost:8008/v1/router',
    SANDBOX_VERSION: 'test-v1',
    TAVILY_API_KEY: 'tvly-test-key',
    SERPER_API_KEY: 'serper-test-key',
    FIRECRAWL_API_KEY: 'firecrawl-test-key',
    REPLICATE_API_TOKEN: 'replicate-test-token',
    JUSTAVPS_PROXY_DOMAIN: 'aether.cloud',
  },
  SANDBOX_VERSION: 'test-v1',
  AETHER_MARKUP: 1.2,
  PLATFORM_FEE_MARKUP: 0.1,
  getToolCost: (_toolName: string, _resultCount: number = 0) => 0.01,
}));

mock.module('../router/config/litellm-config', () => ({
  litellmConfig: {
    LITELLM_URL: 'http://litellm:4000',
    LITELLM_PUBLIC_URL: 'https://llm.aether.cloud',
    LITELLM_MASTER_KEY: 'master-key-test',
    LITELLM_TIMEOUT_MS: 60000,
    LITELLM_NUM_RETRIES: 3,
  },
}));

mock.module('../router/services/litellm-keys', () => ({
  resolveVirtualKey: async (accountId: string) => TEST_LITELLM_KEY,
  syncKeyBudget: async () => {},
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePoolSandbox(overrides: Record<string, any> = {}) {
  return {
    id: 'ps-1',
    resourceId: 'r-1',
    provider: 'justavps' as const,
    externalId: 'ext-123',
    baseUrl: 'https://abc.aether.cloud',
    serverType: 'basic',
    location: 'hel1',
    status: 'ready',
    metadata: { poolPlaceholderToken: 'pool_abc123', justavpsProxyToken: 'proxy_tok' },
    createdAt: new Date(),
    readyAt: new Date(),
    ...overrides,
  };
}

describe('pool/env-injector secret provisioning', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; opts: any }[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
    globalThis.fetch = mock((url: string, opts: any) => {
      fetchCalls.push({ url, opts });
      return Promise.resolve(new Response('OK', { status: 200 }));
    }) as any;
  });

  const restore = () => { globalThis.fetch = originalFetch; };

  it('injects direct upstream URLs instead of proxy URLs', async () => {
    try {
      const { inject } = await import('../pool/env-injector');
      await inject(makePoolSandbox(), 'sk_test_key');

      const body = JSON.parse(fetchCalls[0].opts.body);
      const keys = body.keys;

      expect(keys.TAVILY_API_URL).toBe('https://api.tavily.com');
      expect(keys.SERPER_API_URL).toBe('https://google.serper.dev');
      expect(keys.FIRECRAWL_API_URL).toBe('https://api.firecrawl.dev');
      expect(keys.REPLICATE_API_URL).toBe('https://api.replicate.com');

      // Should NOT contain proxy-style URLs
      expect(keys.TAVILY_API_URL).not.toContain('/v1/router/');
      expect(keys.SERPER_API_URL).not.toContain('/v1/router/');
    } finally {
      restore();
    }
  });

  it('injects direct API keys alongside URLs', async () => {
    try {
      const { inject } = await import('../pool/env-injector');
      await inject(makePoolSandbox(), 'sk_test_key');

      const body = JSON.parse(fetchCalls[0].opts.body);
      const keys = body.keys;

      expect(keys.TAVILY_API_KEY).toBe('tvly-test-key');
      expect(keys.SERPER_API_KEY).toBe('serper-test-key');
      expect(keys.FIRECRAWL_API_KEY).toBe('firecrawl-test-key');
      expect(keys.REPLICATE_API_TOKEN).toBe('replicate-test-token');
    } finally {
      restore();
    }
  });

  it('includes LITELLM_BASE_URL from litellm config', async () => {
    try {
      const { inject } = await import('../pool/env-injector');
      await inject(makePoolSandbox(), 'sk_test_key');

      const body = JSON.parse(fetchCalls[0].opts.body);
      expect(body.keys.LITELLM_BASE_URL).toBe('https://llm.aether.cloud');
    } finally {
      restore();
    }
  });

  it('resolves and injects LiteLLM virtual key when accountId provided', async () => {
    try {
      const { inject } = await import('../pool/env-injector');
      await inject(makePoolSandbox(), 'sk_test_key', 'acct-123');

      const body = JSON.parse(fetchCalls[0].opts.body);
      expect(body.keys.LITELLM_API_KEY).toBe(TEST_LITELLM_KEY);
    } finally {
      restore();
    }
  });

  it('skips LITELLM_API_KEY when no accountId provided', async () => {
    try {
      const { inject } = await import('../pool/env-injector');
      await inject(makePoolSandbox(), 'sk_test_key');

      const body = JSON.parse(fetchCalls[0].opts.body);
      expect(body.keys.LITELLM_API_KEY).toBeUndefined();
    } finally {
      restore();
    }
  });

  it('still creates sandbox when LiteLLM key resolution fails', async () => {
    // Override the litellm-keys mock to fail
    mock.module('../router/services/litellm-keys', () => ({
      resolveVirtualKey: async () => { throw new Error('LiteLLM down'); },
      syncKeyBudget: async () => {},
    }));

    try {
      const { inject } = await import('../pool/env-injector');
      // Should NOT throw
      await inject(makePoolSandbox(), 'sk_test_key', 'acct-456');

      const body = JSON.parse(fetchCalls[0].opts.body);
      // LITELLM_API_KEY absent since resolution failed
      expect(body.keys.LITELLM_API_KEY).toBeUndefined();
      // But LITELLM_BASE_URL still set
      expect(body.keys.LITELLM_BASE_URL).toBe('https://llm.aether.cloud');
    } finally {
      restore();
      // Restore original mock
      mock.module('../router/services/litellm-keys', () => ({
        resolveVirtualKey: async (accountId: string) => TEST_LITELLM_KEY,
        syncKeyBudget: async () => {},
      }));
    }
  });

  it('preserves control plane env vars (TUNNEL, AETHER_TOKEN)', async () => {
    try {
      const { inject } = await import('../pool/env-injector');
      await inject(makePoolSandbox(), 'sk_test_key');

      const body = JSON.parse(fetchCalls[0].opts.body);
      const keys = body.keys;

      expect(keys.TUNNEL_API_URL).toBeDefined();
      expect(keys.TUNNEL_TOKEN).toBe('sk_test_key');
      expect(keys.AETHER_TOKEN).toBe('sk_test_key');
      expect(keys.INTERNAL_SERVICE_KEY).toBe('sk_test_key');
    } finally {
      restore();
    }
  });

  it('computes PUBLIC_BASE_URL from JustAVPS metadata', async () => {
    try {
      const { inject } = await import('../pool/env-injector');

      await inject(makePoolSandbox({
        metadata: {
          poolPlaceholderToken: 'pool_tok',
          justavpsProxyToken: 'proxy_tok',
          justavpsSlug: 'my-app-slug',
        },
      }), 'sk_test_key');

      const body = JSON.parse(fetchCalls[0].opts.body);
      expect(body.keys.PUBLIC_BASE_URL).toContain('8000--my-app-slug');
      expect(body.keys.PUBLIC_BASE_URL).toContain('proxy_tok');
    } finally {
      restore();
    }
  });
});
