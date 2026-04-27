import { eq, and, desc } from 'drizzle-orm';
import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { leads } from '../schemas';

const base = createBaseRepository({ table: leads, db });

export const leadsRepository = {
  ...base,
  async findAll(accountId: string, options?: { limit?: number; offset?: number; vertical?: string }) {
    const conditions = options?.vertical
      ? and(eq(leads.accountId, accountId), eq(leads.vertical, options.vertical as any))
      : eq(leads.accountId, accountId);
    return db.query.leads.findMany({
      where: conditions,
      orderBy: desc(leads.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },
};
