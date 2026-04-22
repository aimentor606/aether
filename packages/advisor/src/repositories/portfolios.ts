import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { portfolios } from '../schemas';

export const portfoliosRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.portfolios.findMany({
      where: eq(portfolios.accountId, accountId),
      orderBy: desc(portfolios.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.portfolios.findFirst({
      where: and(eq(portfolios.accountId, accountId), eq(portfolios.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(portfolios).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(portfolios)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(portfolios.accountId, accountId), eq(portfolios.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(portfolios).where(and(eq(portfolios.accountId, accountId), eq(portfolios.id, id)));
  },
};
