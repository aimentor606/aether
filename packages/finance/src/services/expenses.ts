import { expensesRepository } from '../repositories';
import { createExpenseSchema, updateExpenseSchema } from '@aether/db';
import type { CreateExpenseInput, UpdateExpenseInput } from '@aether/db';

export const expensesService = {
  async listAll(accountId: string) {
    return expensesRepository.findAll(accountId);
  },

  async getById(accountId: string, id: string) {
    const expense = await expensesRepository.findById(accountId, id);
    if (!expense) {
      throw new Error(`Expense ${id} not found`);
    }
    return expense;
  },

  async create(accountId: string, data: CreateExpenseInput) {
    const validated = createExpenseSchema.parse(data);
    return expensesRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: UpdateExpenseInput) {
    const validated = updateExpenseSchema.parse(data);
    const existing = await expensesRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Expense ${id} not found`);
    }
    return expensesRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await expensesRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Expense ${id} not found`);
    }
    await expensesRepository.delete(accountId, id);
  },
};
