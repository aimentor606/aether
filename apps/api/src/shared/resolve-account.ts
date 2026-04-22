import { reconcileResolvedAccount, resolveAccountIdStrict } from './resolve-account-core';
import { logger } from './logger';

export { reconcileResolvedAccount, resolveAccountIdStrict };

/**
 * Backward-compatible account resolver that keeps legacy side effects.
 */
export async function resolveAccountId(userId: string): Promise<string> {
  const accountId = await resolveAccountIdStrict(userId);

  try {
    await reconcileResolvedAccount(userId, accountId);
  } catch (error) {
    logger.warn({ userId, accountId, error }, '[resolve-account] reconciliation wrapper failed');
  }

  return accountId;
}
