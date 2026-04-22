import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { financialPlans } from '../schemas';

export const financialPlansRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.financialPlans.findMany({
      where: eq(financialPlans.accountId, accountId),
      orderBy: desc(financialPlans.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.financialPlans.findFirst({
      where: and(eq(financialPlans.accountId, accountId), eq(financialPlans.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(financialPlans).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(financialPlans)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(financialPlans.accountId, accountId), eq(financialPlans.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(financialPlans).where(and(eq(financialPlans.accountId, accountId), eq(financialPlans.id, id)));
  },
};
