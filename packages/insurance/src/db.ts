import { createDb } from '@aether/db';

export const db = createDb(process.env.DATABASE_URL!);
export type { Database } from '@aether/db';
