import { leadsRepository } from '../repositories';
import { createLeadSchema, updateLeadSchema } from '@aether/db';

export const leadsService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number; vertical?: string }) {
    return leadsRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const lead = await leadsRepository.findById(accountId, id);
    if (!lead) throw new Error(`Lead ${id} not found`);
    return lead;
  },

  async create(accountId: string, data: unknown) {
    const validated = createLeadSchema.parse(data);
    return leadsRepository.create(accountId, { ...validated, vertical: validated.vertical ?? 'advisor' });
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updateLeadSchema.parse(data);
    const existing = await leadsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Lead ${id} not found`);
    return leadsRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await leadsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Lead ${id} not found`);
    await leadsRepository.delete(accountId, id);
  },
};
