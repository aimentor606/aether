import { describe, test, expect, mock, beforeAll } from 'bun:test';
import { mockRegistry, registerGlobalMocks } from './billing/mocks';

registerGlobalMocks();

let supabaseFromResult: Record<string, any>;

function createFromBuilder() {
  const builder: Record<string, any> = {};
  builder.select = () => builder;
  builder.eq = () => builder;
  builder.maybeSingle = () => Promise.resolve({ data: null });
  builder.upsert = () => Promise.resolve({ data: null, error: null });
  return builder;
}

supabaseFromResult = createFromBuilder();
mockRegistry.supabaseFromBuilder = () => supabaseFromResult;

mock.module('../router/config/litellm-config', () => ({
  litellmConfig: {
    LITELLM_URL: 'http://litellm:4000',
    LITELLM_PUBLIC_URL: 'https://llm.aether.dev',
    LITELLM_MASTER_KEY: 'sk-test-master',
    LITELLM_TIMEOUT_MS: 60000,
    LITELLM_NUM_RETRIES: 3,
  },
}));

const { reconcileSpend } = await import('../router/services/spend-reconciler');

const originalFetch = globalThis.fetch;

function mockKeyListResponse(keys: Array<{ key_alias: string; spend: number }>) {
  (globalThis.fetch as any) = mock(async (url: string) => {
    if (typeof url === 'string' && url.includes('/key/list')) {
      return new Response(JSON.stringify({ keys }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('not found', { status: 404 });
  });
}

describe('reconcileSpend (key/info delta)', () => {
  beforeAll(() => {
    mockRegistry.deductCredits = mock(async (_a: string, _amt: number, _d: string) => ({
      success: true,
      cost: _amt,
      newBalance: 100,
    }));
  });

  test('returns empty when no aether keys exist', async () => {
    mockKeyListResponse([
      { key_alias: 'other-key', spend: 5.0 },
    ]);
    const result = await reconcileSpend();
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('deducts delta for aether keys with new spend', async () => {
    mockKeyListResponse([
      { key_alias: 'aether-account-abc', spend: 1.5 },
    ]);
    const result = await reconcileSpend();
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(0);
  });

  test('skips when delta is zero (no new spend)', async () => {
    const originalMaybeSingle = supabaseFromResult.maybeSingle;
    supabaseFromResult.maybeSingle = mock(async () => ({
      data: { last_spend_usd: '5.0' },
    }));

    mockKeyListResponse([
      { key_alias: 'aether-account-abc', spend: 5.0 },
    ]);
    const result = await reconcileSpend();
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);

    supabaseFromResult.maybeSingle = originalMaybeSingle;
  });

  test('skips when spend decreased (budget reset)', async () => {
    const originalMaybeSingle = supabaseFromResult.maybeSingle;
    supabaseFromResult.maybeSingle = mock(async () => ({
      data: { last_spend_usd: '10.0' },
    }));

    mockKeyListResponse([
      { key_alias: 'aether-account-abc', spend: 2.0 },
    ]);
    const result = await reconcileSpend();
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);

    supabaseFromResult.maybeSingle = originalMaybeSingle;
  });

  test('handles multiple keys in one pass', async () => {
    mockKeyListResponse([
      { key_alias: 'aether-account-1', spend: 3.0 },
      { key_alias: 'aether-account-2', spend: 0.5 },
      { key_alias: 'other-system-key', spend: 100.0 },
    ]);
    const result = await reconcileSpend();
    expect(result.processed).toBe(2);
    expect(result.skipped).toBe(0);
  });

  test('handles LiteLLM fetch failure by throwing', async () => {
    (globalThis.fetch as any) = mock(async () =>
      new Response('internal error', { status: 500 }),
    );

    try {
      await reconcileSpend();
      expect.unreachable('Should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('LiteLLM key list failed');
    }
  });

  test('continues on per-key error and reports errors count', async () => {
    const originalMaybeSingle = supabaseFromResult.maybeSingle;
    let callCount = 0;
    supabaseFromResult.maybeSingle = mock(async () => {
      callCount++;
      if (callCount === 1) throw new Error('DB timeout');
      return { data: null };
    });

    mockRegistry.deductCredits = mock(async () => { throw new Error('Credits RPC failed'); });

    mockKeyListResponse([
      { key_alias: 'aether-account-fail', spend: 1.0 },
      { key_alias: 'aether-account-ok', spend: 2.0 },
    ]);

    const result = await reconcileSpend();
    expect(result.errors).toBeGreaterThanOrEqual(1);

    supabaseFromResult.maybeSingle = originalMaybeSingle;
    mockRegistry.deductCredits = mock(async (_a: string, _amt: number, _d: string) => ({
      success: true, cost: _amt, newBalance: 100,
    }));
  });

  test('cleanup', () => {
    globalThis.fetch = originalFetch;
    expect(true).toBe(true);
  });
});
