import { financialPlansRepository } from '../repositories';
import { createFinancialPlanSchema, updateFinancialPlanSchema } from '@aether/db';

export const financialPlansService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return financialPlansRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const plan = await financialPlansRepository.findById(accountId, id);
    if (!plan) throw new Error(`Financial plan ${id} not found`);
    return plan;
  },

  async create(accountId: string, data: unknown) {
    const validated = createFinancialPlanSchema.parse(data);
    return financialPlansRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updateFinancialPlanSchema.parse(data);
    const existing = await financialPlansRepository.findById(accountId, id);
    if (!existing) throw new Error(`Financial plan ${id} not found`);
    return financialPlansRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await financialPlansRepository.findById(accountId, id);
    if (!existing) throw new Error(`Financial plan ${id} not found`);
    await financialPlansRepository.delete(accountId, id);
  },
};
