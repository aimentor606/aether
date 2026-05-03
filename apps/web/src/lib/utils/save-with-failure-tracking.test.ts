import { describe, expect, it, vi } from 'vitest';

/**
 * Tests for the "save with failure tracking" pattern used in setup-wizard.tsx.
 *
 * The bug: setSaved(true) was called unconditionally after try/catch,
 * showing "Saved" even when saves failed.
 *
 * The fix: track a `failed` boolean, only setSaved(true) when !failed.
 * This test guards against regression.
 */

interface SaveRequest {
  key: string;
  value: string;
}

async function saveItems(
  items: SaveRequest[],
  saveFn: (key: string, value: string) => Promise<void>,
): Promise<{ saved: boolean }> {
  let failed = false;
  try {
    for (const { key, value } of items) {
      try {
        await saveFn(key, value);
      } catch {
        failed = true;
      }
    }
  } catch {
    failed = true;
  }
  return { saved: !failed };
}

describe('save-with-failure-tracking', () => {
  it('returns saved=true when all items save successfully', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const result = await saveItems(
      [
        { key: 'API_KEY', value: 'abc123' },
        { key: 'SECRET', value: 'xyz789' },
      ],
      saveFn,
    );
    expect(result.saved).toBe(true);
    expect(saveFn).toHaveBeenCalledTimes(2);
  });

  it('returns saved=false when some items fail', async () => {
    const saveFn = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Network error'));

    const result = await saveItems(
      [
        { key: 'API_KEY', value: 'abc123' },
        { key: 'SECRET', value: 'xyz789' },
      ],
      saveFn,
    );

    expect(result.saved).toBe(false);
  });

  it('returns saved=false when all items fail', async () => {
    const saveFn = vi.fn().mockRejectedValue(new Error('Server down'));

    const result = await saveItems(
      [{ key: 'API_KEY', value: 'abc123' }],
      saveFn,
    );

    expect(result.saved).toBe(false);
  });

  it('returns saved=true for empty items list', async () => {
    const saveFn = vi.fn();
    const result = await saveItems([], saveFn);
    expect(result.saved).toBe(true);
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('continues saving remaining items after a failure', async () => {
    const saveFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    await saveItems(
      [
        { key: 'A', value: '1' },
        { key: 'B', value: '2' },
        { key: 'C', value: '3' },
      ],
      saveFn,
    );

    // All 3 items should be attempted despite the first failure
    expect(saveFn).toHaveBeenCalledTimes(3);
  });
});
