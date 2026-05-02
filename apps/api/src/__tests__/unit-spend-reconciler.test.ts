import { describe, test, expect, mock, beforeAll, beforeEach } from 'bun:test';
import { mockRegistry, registerGlobalMocks } from './billing/mocks';

registerGlobalMocks();

// Mock openmeter queryUsage
const mockQueryUsage = mock(async () => null);

mock.module('../shared/openmeter', () => ({
  queryUsage: mockQueryUsage,
  emitCloudEvent: mock(() => {}),
  queryTotalUsage: mock(async () => null),
}));

const { reconcileSpend } = await import('../router/services/spend-reconciler');

describe('reconcileSpend (OpenMeter)', () => {
  let supabaseFromResult: Record<string, any>;

  beforeAll(() => {
    mockRegistry.deductCredits = mock(async (_a: string, _amt: number, _d: string) => ({
      success: true,
      cost: _amt,
      newBalance: 100,
    }));
  });

  beforeEach(() => {
    mockQueryUsage.mockClear();

    // Reset supabase from builder
    supabaseFromResult = {} as any;
    supabaseFromResult.select = mock(() => supabaseFromResult);
    supabaseFromResult.eq = mock(() => supabaseFromResult);
    supabaseFromResult.limit = mock(async () => ({
      data: [{ account_id: 'acc-1' }],
      error: null,
    }));
    supabaseFromResult.maybeSingle = mock(async () => ({ data: null }));
    supabaseFromResult.upsert = mock(async () => ({ data: null, error: null }));
    mockRegistry.supabaseFromBuilder = () => supabaseFromResult;
  });

  test('skips when OpenMeter returns null (unavailable)', async () => {
    mockQueryUsage.mockResolvedValueOnce(null);

    const result = await reconcileSpend();
    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
  });

  test('deducts delta when OpenMeter reports new spend', async () => {
    mockQueryUsage.mockResolvedValueOnce([
      { value: 5.0, windowStart: '2026-01-01', windowEnd: '2026-01-02', subject: 'acc-1' },
    ]);

    const result = await reconcileSpend();
    expect(result.processed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  test('skips when delta is zero (no new spend)', async () => {
    supabaseFromResult.maybeSingle = mock(async () => ({
      data: { last_spend_usd: '5.0' },
    }));

    mockQueryUsage.mockResolvedValueOnce([
      { value: 5.0, windowStart: '2026-01-01', windowEnd: '2026-01-02', subject: 'acc-1' },
    ]);

    const result = await reconcileSpend();
    expect(result.processed).toBe(0);
    expect(result.skipped).toBe(1);
  });

  test('continues on per-account error and reports errors count', async () => {
    let callCount = 0;
    supabaseFromResult.maybeSingle = mock(async () => {
      callCount++;
      if (callCount === 1) throw new Error('DB timeout');
      return { data: null };
    });

    mockQueryUsage.mockResolvedValue([
      { value: 1.0, windowStart: '2026-01-01', windowEnd: '2026-01-02', subject: 'acc-1' },
    ]);

    const result = await reconcileSpend();
    expect(result.errors).toBeGreaterThanOrEqual(1);
  });
});
