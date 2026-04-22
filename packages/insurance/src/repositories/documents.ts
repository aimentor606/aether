import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { documents } from '../schemas';

export const documentsRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    const conditions = [eq(documents.accountId, accountId)];
    if (options?.entityType) conditions.push(eq(documents.entityType, options.entityType));
    if (options?.entityId) conditions.push(eq(documents.entityId, options.entityId));
    return db.query.documents.findMany({
      where: and(...conditions),
      orderBy: desc(documents.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.documents.findFirst({
      where: and(eq(documents.accountId, accountId), eq(documents.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(documents).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(documents.accountId, accountId), eq(documents.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(documents).where(and(eq(documents.accountId, accountId), eq(documents.id, id)));
  },
};
