import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { policies } from '../schemas';

export const policiesRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.policies.findMany({
      where: eq(policies.accountId, accountId),
      orderBy: desc(policies.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.policies.findFirst({
      where: and(eq(policies.accountId, accountId), eq(policies.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(policies).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(policies)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(policies.accountId, accountId), eq(policies.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(policies).where(and(eq(policies.accountId, accountId), eq(policies.id, id)));
  },
};
