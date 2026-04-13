import { budgetsRepository } from '../repositories';
import { createBudgetSchema, updateBudgetSchema } from '@acme/db';
import type { CreateBudgetInput, UpdateBudgetInput } from '@acme/db';

export const budgetsService = {
  async listAll(accountId: string) {
    return budgetsRepository.findAll(accountId);
  },

  async getById(accountId: string, id: string) {
    const budget = await budgetsRepository.findById(accountId, id);
    if (!budget) {
      throw new Error(`Budget ${id} not found`);
    }
    return budget;
  },

  async create(accountId: string, data: CreateBudgetInput) {
    const validated = createBudgetSchema.parse(data);
    return budgetsRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: UpdateBudgetInput) {
    const validated = updateBudgetSchema.parse(data);
    const existing = await budgetsRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Budget ${id} not found`);
    }
    return budgetsRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await budgetsRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Budget ${id} not found`);
    }
    await budgetsRepository.delete(accountId, id);
  },
};
