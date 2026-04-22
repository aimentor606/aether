import { policiesRepository } from '../repositories';
import { createPolicySchema, updatePolicySchema } from '@aether/db';

export const policiesService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return policiesRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const policy = await policiesRepository.findById(accountId, id);
    if (!policy) throw new Error(`Policy ${id} not found`);
    return policy;
  },

  async create(accountId: string, data: unknown) {
    const validated = createPolicySchema.parse(data);
    return policiesRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updatePolicySchema.parse(data);
    const existing = await policiesRepository.findById(accountId, id);
    if (!existing) throw new Error(`Policy ${id} not found`);
    return policiesRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await policiesRepository.findById(accountId, id);
    if (!existing) throw new Error(`Policy ${id} not found`);
    await policiesRepository.delete(accountId, id);
  },
};
