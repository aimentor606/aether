import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { budgets } from '../schemas';
import type { CreateBudgetInput, UpdateBudgetInput } from '../schemas';

export const budgetsRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.budgets.findMany({
      where: eq(budgets.accountId, accountId),
      orderBy: desc(budgets.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.budgets.findFirst({
      where: and(
        eq(budgets.accountId, accountId),
        eq(budgets.id, id)
      ),
    });
  },

  async create(accountId: string, data: CreateBudgetInput) {
    const [result] = await db
      .insert(budgets)
      .values({
        accountId,
        budgetName: data.budgetName,
        period: data.period || 'monthly',
        totalBudget: String(data.totalBudget),
        currency: data.currency || 'USD',
        startDate: typeof data.startDate === 'string' 
          ? new Date(data.startDate) 
          : data.startDate,
        endDate: typeof data.endDate === 'string' 
          ? new Date(data.endDate) 
          : data.endDate,
        departmentId: data.departmentId,
        departmentName: data.departmentName,
        ...(data.categories && { categories: data.categories }),
        ...(data.alerts && { alerts: data.alerts }),
        metadata: data.metadata,
      })
      .returning();
    return result;
  },

  async update(accountId: string, id: string, data: UpdateBudgetInput) {
    const [result] = await db
      .update(budgets)
      .set({
        ...(data.budgetName && { budgetName: data.budgetName }),
        ...(data.period && { period: data.period }),
        ...(data.totalBudget && { totalBudget: String(data.totalBudget) }),
        ...(data.currency && { currency: data.currency }),
        ...(data.startDate && { 
          startDate: typeof data.startDate === 'string' 
            ? new Date(data.startDate) 
            : data.startDate 
        }),
        ...(data.endDate && { 
          endDate: typeof data.endDate === 'string' 
            ? new Date(data.endDate) 
            : data.endDate 
        }),
        ...(data.departmentId && { departmentId: data.departmentId }),
        ...(data.departmentName && { departmentName: data.departmentName }),
        ...(data.categories && { categories: data.categories }),
        ...(data.alerts && { alerts: data.alerts }),
        ...(data.metadata && { metadata: data.metadata }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(budgets.accountId, accountId),
        eq(budgets.id, id)
      ))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db
      .delete(budgets)
      .where(and(
        eq(budgets.accountId, accountId),
        eq(budgets.id, id)
      ));
  },
};
