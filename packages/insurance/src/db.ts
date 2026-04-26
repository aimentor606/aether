import { createDb } from '@aether/db';
import { getTenantTransaction } from '@aether/db';

const baseDb = createDb(process.env.DATABASE_URL!);
export const db = new Proxy(baseDb, {
  get(target, prop, receiver) {
    const tx = getTenantTransaction<typeof target>();
    const source = tx ?? target;
    return Reflect.get(source, prop, receiver);
  },
}) as typeof baseDb;
export type { Database } from '@aether/db';
