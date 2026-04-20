import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { ledgers } from '../schemas';
import type { CreateLedgerInput, UpdateLedgerInput } from '../schemas';

export const ledgersRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.ledgers.findMany({
      where: eq(ledgers.accountId, accountId),
      orderBy: desc(ledgers.entryDate),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.ledgers.findFirst({
      where: and(
        eq(ledgers.accountId, accountId),
        eq(ledgers.id, id)
      ),
    });
  },

  async create(accountId: string, data: CreateLedgerInput) {
    const [result] = await db
      .insert(ledgers)
      .values({
        accountId,
        journalEntry: data.journalEntry,
        debitAmount: data.debitAmount ? String(data.debitAmount) : '0',
        creditAmount: data.creditAmount ? String(data.creditAmount) : '0',
        ledgerAccount: data.ledgerAccount,
        description: data.description,
        status: data.status || 'draft',
        entryDate: typeof data.entryDate === 'string'
          ? new Date(data.entryDate)
          : data.entryDate,
        reference: data.reference,
      })
      .returning();
    return result;
  },

  async update(accountId: string, id: string, data: UpdateLedgerInput) {
    const [result] = await db
      .update(ledgers)
      .set({
        ...(data.journalEntry && { journalEntry: data.journalEntry }),
        ...(data.debitAmount && { debitAmount: String(data.debitAmount) }),
        ...(data.creditAmount && { creditAmount: String(data.creditAmount) }),
        ...(data.ledgerAccount && { ledgerAccount: data.ledgerAccount }),
        ...(data.description && { description: data.description }),
        ...(data.status && { status: data.status }),
        ...(data.entryDate && {
          entryDate: typeof data.entryDate === 'string'
            ? new Date(data.entryDate)
            : data.entryDate
        }),
        ...(data.reference && { reference: data.reference }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(ledgers.accountId, accountId),
        eq(ledgers.id, id)
      ))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db
      .delete(ledgers)
      .where(and(
        eq(ledgers.accountId, accountId),
        eq(ledgers.id, id)
      ));
  },
};
