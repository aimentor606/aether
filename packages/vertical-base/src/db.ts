import { createDb } from '@aether/db';
import { getTenantTransaction } from '@aether/db';

/**
 * Create a tenant-aware database proxy.
 *
 * The proxy delegates to an active tenant-scoped transaction (set via
 * `withTenantContext`) when one exists, otherwise falls back to the base
 * connection. This is the same ES Proxy pattern used by every vertical
 * package.
 *
 * @param databaseUrl - PostgreSQL connection string (defaults to `process.env.DATABASE_URL`)
 */
export function createTenantDb(databaseUrl?: string) {
  const url = databaseUrl ?? process.env.DATABASE_URL!;
  const baseDb = createDb(url);

  const db = new Proxy(baseDb, {
    get(target, prop, receiver) {
      const tx = getTenantTransaction<typeof target>();
      const source = tx ?? target;
      return Reflect.get(source, prop, receiver);
    },
  }) as typeof baseDb;

  return db;
}

export type { Database } from '@aether/db';
