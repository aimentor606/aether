import { documentsRepository } from '../repositories';
import { createDocumentSchema, updateDocumentSchema } from '@aether/db';

export const documentsService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number; entityType?: string; entityId?: string }) {
    return documentsRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const doc = await documentsRepository.findById(accountId, id);
    if (!doc) throw new Error(`Document ${id} not found`);
    return doc;
  },

  async create(accountId: string, data: unknown) {
    const validated = createDocumentSchema.parse(data);
    return documentsRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updateDocumentSchema.parse(data);
    const existing = await documentsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Document ${id} not found`);
    return documentsRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await documentsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Document ${id} not found`);
    await documentsRepository.delete(accountId, id);
  },
};
