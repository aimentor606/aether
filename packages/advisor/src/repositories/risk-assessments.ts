import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { riskAssessments } from '../schemas';

export const riskAssessmentsRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.riskAssessments.findMany({
      where: eq(riskAssessments.accountId, accountId),
      orderBy: desc(riskAssessments.assessedAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.riskAssessments.findFirst({
      where: and(eq(riskAssessments.accountId, accountId), eq(riskAssessments.id, id)),
    });
  },

  async create(accountId: string, data: any) {
    const [result] = await db.insert(riskAssessments).values({ accountId, ...data }).returning();
    return result;
  },

  async update(accountId: string, id: string, data: any) {
    const [result] = await db
      .update(riskAssessments)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(riskAssessments.accountId, accountId), eq(riskAssessments.id, id)))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db.delete(riskAssessments).where(and(eq(riskAssessments.accountId, accountId), eq(riskAssessments.id, id)));
  },
};
