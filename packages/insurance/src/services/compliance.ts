import { complianceRepository } from '../repositories';
import { createComplianceSchema, updateComplianceSchema } from '@aether/db';

export const complianceService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    return complianceRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const record = await complianceRepository.findById(accountId, id);
    if (!record) throw new Error(`Compliance record ${id} not found`);
    return record;
  },

  async create(accountId: string, data: unknown) {
    const validated = createComplianceSchema.parse(data);
    return complianceRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updateComplianceSchema.parse(data);
    const existing = await complianceRepository.findById(accountId, id);
    if (!existing) throw new Error(`Compliance record ${id} not found`);
    return complianceRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await complianceRepository.findById(accountId, id);
    if (!existing) throw new Error(`Compliance record ${id} not found`);
    await complianceRepository.delete(accountId, id);
  },
};
