import { ledgersRepository } from '../repositories';
import { createLedgerSchema, updateLedgerSchema } from '@aether/db';
import type { CreateLedgerInput, UpdateLedgerInput } from '@aether/db';

export const ledgersService = {
  async listAll(accountId: string) {
    return ledgersRepository.findAll(accountId);
  },

  async getById(accountId: string, id: string) {
    const ledger = await ledgersRepository.findById(accountId, id);
    if (!ledger) {
      throw new Error(`Ledger ${id} not found`);
    }
    return ledger;
  },

  async create(accountId: string, data: CreateLedgerInput) {
    const validated = createLedgerSchema.parse(data);
    return ledgersRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: UpdateLedgerInput) {
    const validated = updateLedgerSchema.parse(data);
    const existing = await ledgersRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Ledger ${id} not found`);
    }
    return ledgersRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await ledgersRepository.findById(accountId, id);
    if (!existing) {
      throw new Error(`Ledger ${id} not found`);
    }
    await ledgersRepository.delete(accountId, id);
  },
};
