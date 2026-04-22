import { claimsRepository } from '../repositories';
import { createClaimSchema, updateClaimSchema } from '@aether/db';

export const claimsService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return claimsRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const claim = await claimsRepository.findById(accountId, id);
    if (!claim) throw new Error(`Claim ${id} not found`);
    return claim;
  },

  async create(accountId: string, data: unknown) {
    const validated = createClaimSchema.parse(data);
    return claimsRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updateClaimSchema.parse(data);
    const existing = await claimsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Claim ${id} not found`);
    return claimsRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await claimsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Claim ${id} not found`);
    await claimsRepository.delete(accountId, id);
  },
};
