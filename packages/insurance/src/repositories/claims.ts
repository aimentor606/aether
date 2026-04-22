import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { claims } from '../schemas';

export const claimsRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.claims.findMany({
      where: eq(claims.accountId, accountId),
      orderBy: desc(claims.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.claims.findFirst({
      where: and(eq(claims.accountId, accountId), eq(claims.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(claims).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(claims)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(claims.accountId, accountId), eq(claims.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(claims).where(and(eq(claims.accountId, accountId), eq(claims.id, id)));
  },
};
