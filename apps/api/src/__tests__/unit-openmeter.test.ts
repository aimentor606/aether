import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock config before importing the module under test
const mockConfig = {
  OPENMETER_URL: 'http://localhost:8888',
  OPENMETER_API_KEY: 'test-key',
};

mock.module('../config', () => ({
  config: mockConfig,
}));

// Mock the SDK
const mockIngest = mock(() => Promise.resolve(undefined));
const mockQuery = mock(() =>
  Promise.resolve({
    data: [
      {
        value: 100,
        windowStart: new Date('2026-01-01'),
        windowEnd: new Date('2026-01-02'),
        subject: 'account-1',
      },
    ],
  }),
);

mock.module('@openmeter/sdk', () => ({
  OpenMeter: class {
    events = { ingest: mockIngest };
    meters = { query: mockQuery };
  },
}));

const { emitCloudEvent, queryUsage, queryTotalUsage } = await import(
  '../shared/openmeter'
);

describe('OpenMeter client', () => {
  beforeEach(() => {
    mockIngest.mockClear();
    mockQuery.mockClear();
  });

  describe('emitCloudEvent', () => {
    test('ingests event via SDK', async () => {
      emitCloudEvent('test-type', 'user-1', { tokens: 50 });

      // fire-and-forget — wait for microtask
      await new Promise((r) => setTimeout(r, 10));

      expect(mockIngest).toHaveBeenCalledTimes(1);
      const call = mockIngest.mock.calls[0];
      expect(call).toBeDefined();
      const event = call![0] as Record<string, unknown>;
      expect(event.type).toBe('test-type');
      expect(event.subject).toBe('user-1');
      expect(event.data).toEqual({ tokens: 50 });
    });

    test('does nothing when OPENMETER_URL is empty', () => {
      const saved = mockConfig.OPENMETER_URL;
      mockConfig.OPENMETER_URL = '';
      emitCloudEvent('test', 'user', {});
      mockConfig.OPENMETER_URL = saved;

      expect(mockIngest).not.toHaveBeenCalled();
    });

    test('swallows ingest errors', async () => {
      mockIngest.mockRejectedValueOnce(new Error('network'));

      // Should not throw
      emitCloudEvent('test', 'user', { ok: true });
      await new Promise((r) => setTimeout(r, 10));
    });
  });

  describe('queryUsage', () => {
    test('queries meter and maps response', async () => {
      const result = await queryUsage('litellm_tokens', {
        subject: 'account-1',
        windowSize: 'DAY',
      });

      expect(result).not.toBeNull();
      expect(result!.length).toBe(1);
      expect(result![0].value).toBe(100);
      expect(result![0].subject).toBe('account-1');
      expect(mockQuery).toHaveBeenCalledWith(
        'litellm_tokens',
        expect.objectContaining({ subject: ['account-1'], windowSize: 'DAY' }),
      );
    });

    test('returns null when OPENMETER_URL is empty', async () => {
      const saved = mockConfig.OPENMETER_URL;
      mockConfig.OPENMETER_URL = '';
      const result = await queryUsage('test', { subject: 'x' });
      mockConfig.OPENMETER_URL = saved;

      expect(result).toBeNull();
    });

    test('returns null on SDK error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('timeout'));
      const result = await queryUsage('test', { subject: 'x' });

      expect(result).toBeNull();
    });
  });

  describe('queryTotalUsage', () => {
    test('sums all data points', async () => {
      mockQuery.mockResolvedValueOnce({
        data: [
          { value: 10, windowStart: new Date(), windowEnd: new Date(), subject: 'a' },
          { value: 20, windowStart: new Date(), windowEnd: new Date(), subject: 'a' },
        ],
      });

      const total = await queryTotalUsage('meter', 'a');
      expect(total).toBe(30);
    });

    test('returns null when queryUsage returns null', async () => {
      mockQuery.mockRejectedValueOnce(new Error('fail'));
      const total = await queryTotalUsage('meter', 'a');
      expect(total).toBeNull();
    });
  });
});
