import { invoicesRepository } from '../repositories';
import { createInvoiceSchema, updateInvoiceSchema } from '@acme/db';
import type { CreateInvoiceInput, UpdateInvoiceInput } from '@acme/db';

export const invoicesService = {
  async listAll(accountId: string) {
    return invoicesRepository.findAll(accountId);
  },

  async getById(accountId: string, id: string) {
    const invoice = await invoicesRepository.findById(accountId, id);
    if (!invoice) {
      throw new Error(`Invoice ${id} not found`);
    }
    return invoice;
  },

  async create(accountId: string, data: CreateInvoiceInput) {
    const validated = createInvoiceSchema.parse(data);
    return invoicesRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: UpdateInvoiceInput) {
    const validated = updateInvoiceSchema.parse(data);
    const existing = await invoicesRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Invoice ${id} not found`);
    }
    return invoicesRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await invoicesRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Invoice ${id} not found`);
    }
    await invoicesRepository.delete(accountId, id);
  },
};
