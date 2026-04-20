import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { expenses } from '../schemas';
import type { CreateExpenseInput, UpdateExpenseInput } from '../schemas';

export const expensesRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.expenses.findMany({
      where: eq(expenses.accountId, accountId),
      orderBy: desc(expenses.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.expenses.findFirst({
      where: and(
        eq(expenses.accountId, accountId),
        eq(expenses.id, id)
      ),
    });
  },

  async create(accountId: string, data: CreateExpenseInput) {
    const [result] = await db
      .insert(expenses)
      .values({
        accountId,
        expenseNumber: data.expenseNumber,
        employeeId: data.employeeId,
        employeeName: data.employeeName,
        category: data.category,
        description: data.description,
        amount: String(data.amount),
        currency: data.currency || 'USD',
        expenseDate: typeof data.expenseDate === 'string' 
          ? new Date(data.expenseDate) 
          : data.expenseDate,
        receipts: data.receipts || [],
        metadata: data.metadata || {},
      })
      .returning();
    return result;
  },

  async update(accountId: string, id: string, data: UpdateExpenseInput) {
    const [result] = await db
      .update(expenses)
      .set({
        ...(data.expenseNumber && { expenseNumber: data.expenseNumber }),
        ...(data.employeeId && { employeeId: data.employeeId }),
        ...(data.employeeName && { employeeName: data.employeeName }),
        ...(data.category && { category: data.category }),
        ...(data.description && { description: data.description }),
        ...(data.amount && { amount: String(data.amount) }),
        ...(data.currency && { currency: data.currency }),
        ...(data.expenseDate && { 
          expenseDate: typeof data.expenseDate === 'string' 
            ? new Date(data.expenseDate) 
            : data.expenseDate 
        }),
        ...(data.receipts && { receipts: data.receipts }),
        ...(data.metadata && { metadata: data.metadata }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(expenses.accountId, accountId),
        eq(expenses.id, id)
      ))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db
      .delete(expenses)
      .where(and(
        eq(expenses.accountId, accountId),
        eq(expenses.id, id)
      ));
  },
};
