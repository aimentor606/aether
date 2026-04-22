import { portfoliosRepository } from '../repositories';
import { createPortfolioSchema, updatePortfolioSchema } from '@aether/db';

export const portfoliosService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return portfoliosRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const portfolio = await portfoliosRepository.findById(accountId, id);
    if (!portfolio) throw new Error(`Portfolio ${id} not found`);
    return portfolio;
  },

  async create(accountId: string, data: unknown) {
    const validated = createPortfolioSchema.parse(data);
    return portfoliosRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updatePortfolioSchema.parse(data);
    const existing = await portfoliosRepository.findById(accountId, id);
    if (!existing) throw new Error(`Portfolio ${id} not found`);
    return portfoliosRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await portfoliosRepository.findById(accountId, id);
    if (!existing) throw new Error(`Portfolio ${id} not found`);
    await portfoliosRepository.delete(accountId, id);
  },
};
