import { describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createDb, withTenantContext } from '..';

const DATABASE_URL = process.env.DATABASE_URL;
const hasDb = Boolean(DATABASE_URL);

describe('withTenantContext', () => {
  test.if(hasDb)(
    'sets local tenant session variable within transaction',
    async () => {
      const db = createDb(DATABASE_URL!);

      const currentAccount = await withTenantContext(
        db,
        'test-account-id',
        async (tx) => {
          const result = await tx.execute<{ current_account: string | null }>(
            sql`SELECT current_setting('aether.current_account_id', true) AS current_account`,
          );
          return result[0]?.current_account ?? null;
        },
      );

      expect(currentAccount).toBe('test-account-id');
    },
  );

  test('does not execute callback when accountId is empty', async () => {
    const db = {
      async transaction<T>(
        callback: (tx: { execute: (query: string | { getSQL: () => unknown }) => Promise<unknown[]> }) => Promise<T>,
      ): Promise<T> {
        const tx = {
          async execute(query: string | { getSQL: () => unknown }): Promise<unknown[]> {
            if (!query) return [];
            return [];
          },
        };

        return callback(tx);
      },
    };

    let invoked = false;

    await expect(
      withTenantContext(db, '', async () => {
        invoked = true;
        return 'unreachable';
      }),
    ).rejects.toThrow('accountId is required');

    expect(invoked).toBe(false);
  });
});
