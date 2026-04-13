import { createDb } from '@acme/db';

export const db = createDb(process.env.DATABASE_URL!);
export type { Database } from '@acme/db';
