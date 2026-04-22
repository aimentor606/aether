import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { complianceRecords } from '../schemas';

export const complianceRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    const conditions = [eq(complianceRecords.accountId, accountId)];
    if (options?.entityType) conditions.push(eq(complianceRecords.entityType, options.entityType));
    if (options?.entityId) conditions.push(eq(complianceRecords.entityId, options.entityId));
    return db.query.complianceRecords.findMany({
      where: and(...conditions),
      orderBy: desc(complianceRecords.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.complianceRecords.findFirst({
      where: and(eq(complianceRecords.accountId, accountId), eq(complianceRecords.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(complianceRecords).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(complianceRecords)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(complianceRecords.accountId, accountId), eq(complianceRecords.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(complianceRecords).where(and(eq(complianceRecords.accountId, accountId), eq(complianceRecords.id, id)));
  },
};
