import type { Context } from 'hono';
import { withTenantContext } from '@aether/db';

type TransactionCapableDb = Parameters<typeof withTenantContext>[0];

export function createTenantRlsMiddleware(
  db: TransactionCapableDb | null,
  runWithTenantContext: typeof withTenantContext = withTenantContext,
) {
  return async (c: Context<{ Variables: { accountId?: string } }>, next: () => Promise<void>) => {
    if (!db) {
      await next();
      return;
    }

    const accountId = c.get('accountId') as string | undefined;
    if (!accountId) {
      await next();
      return;
    }

    await runWithTenantContext(db, accountId, async () => {
      await next();
      return null;
    });
  };
}
