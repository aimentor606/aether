import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { leads } from '../schemas';

export const leadsRepository = {
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

  async findById(accountId: string, id: string) {
    return db.query.leads.findFirst({
      where: and(eq(leads.accountId, accountId), eq(leads.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(leads).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(leads)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(leads.accountId, accountId), eq(leads.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(leads).where(and(eq(leads.accountId, accountId), eq(leads.id, id)));
  },
};
