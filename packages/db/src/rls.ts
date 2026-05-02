import { sql, type SQLWrapper } from 'drizzle-orm';
import { AsyncLocalStorage } from 'node:async_hooks';

export type TransactionCapableDb<TTx> = {
  transaction<T>(callback: (tx: TTx) => Promise<T>): Promise<T>;
};

type TxWithExecute = {
  execute: (query: string | SQLWrapper) => unknown;
};

const tenantTxStorage = new AsyncLocalStorage<{ tx: unknown }>();

export function getTenantTransaction<TTx = unknown>(): TTx | undefined {
  return tenantTxStorage.getStore()?.tx as TTx | undefined;
}

export async function runWithTenantTransaction<TResult>(
  tx: unknown,
  callback: () => Promise<TResult>,
): Promise<TResult> {
  return tenantTxStorage.run({ tx }, callback);
}

export async function withTenantContext<TTx extends TxWithExecute, TResult>(
  database: TransactionCapableDb<TTx>,
  accountId: string,
  callback: (tx: TTx) => Promise<TResult> | TResult,
): Promise<TResult> {
  if (!accountId.trim()) {
    throw new Error('accountId is required');
  }

  return database.transaction(async (tx) => {
    return runWithTenantTransaction(tx, async () => {
      await tx.execute(
        sql`SELECT set_config('aether.current_account_id', ${accountId}, true)`,
      );
      return callback(tx);
    });
  });
}
