import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { invoices } from '../schemas';
import type { CreateInvoiceInput, UpdateInvoiceInput } from '../schemas';

export const invoicesRepository = {
  async findAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return db.query.invoices.findMany({
      where: eq(invoices.accountId, accountId),
      orderBy: desc(invoices.createdAt),
      limit: options?.limit ?? 50,
      offset: options?.offset ?? 0,
    });
  },

  async findById(accountId: string, id: string) {
    return db.query.invoices.findFirst({
      where: and(
        eq(invoices.accountId, accountId),
        eq(invoices.id, id)
      ),
    });
  },

  async create(accountId: string, data: CreateInvoiceInput) {
    const [result] = await db
      .insert(invoices)
      .values({
        accountId,
        invoiceNumber: data.invoiceNumber,
        clientName: data.clientName,
        amount: String(data.amount),
        status: data.status || 'draft',
        issuedDate: typeof data.issuedDate === 'string' 
          ? new Date(data.issuedDate) 
          : data.issuedDate,
        dueDate: data.dueDate
          ? (typeof data.dueDate === 'string' ? new Date(data.dueDate) : data.dueDate)
          : undefined,
        items: data.items || [],
      })
      .returning();
    return result;
  },

  async update(accountId: string, id: string, data: UpdateInvoiceInput) {
    const [result] = await db
      .update(invoices)
      .set({
        ...(data.invoiceNumber && { invoiceNumber: data.invoiceNumber }),
        ...(data.clientName && { clientName: data.clientName }),
        ...(data.amount && { amount: String(data.amount) }),
        ...(data.status && { status: data.status }),
        ...(data.issuedDate && { 
          issuedDate: typeof data.issuedDate === 'string' 
            ? new Date(data.issuedDate) 
            : data.issuedDate 
        }),
        ...(data.dueDate && { 
          dueDate: typeof data.dueDate === 'string' 
            ? new Date(data.dueDate) 
            : data.dueDate 
        }),
        ...(data.items && { items: data.items }),
        updatedAt: new Date(),
      })
      .where(and(
        eq(invoices.accountId, accountId),
        eq(invoices.id, id)
      ))
      .returning();
    return result;
  },

  async delete(accountId: string, id: string) {
    await db
      .delete(invoices)
      .where(and(
        eq(invoices.accountId, accountId),
        eq(invoices.id, id)
      ));
  },
};
