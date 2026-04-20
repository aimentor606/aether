// Finance vertical service layer — delegates to @aether/vertical-finance

import {
  invoicesService,
  expensesService,
  budgetsService,
  ledgersService,
} from '@aether/vertical-finance';

export {
  invoicesService,
  expensesService,
  budgetsService,
  ledgersService,
};

// Convenience re-exports for the vertical route layer
export const financeService = {
  // Invoices
  async listInvoices(accountId: string, options?: { limit?: number; offset?: number }) {
    return invoicesService.listAll(accountId, options);
  },
  async createInvoice(accountId: string, data: unknown) {
    return invoicesService.create(accountId, data as Parameters<typeof invoicesService.create>[1]);
  },
  async getInvoice(accountId: string, id: string) {
    return invoicesService.getById(accountId, id);
  },
  async updateInvoice(accountId: string, id: string, data: unknown) {
    return invoicesService.update(accountId, id, data as Parameters<typeof invoicesService.update>[2]);
  },
  async deleteInvoice(accountId: string, id: string) {
    return invoicesService.delete(accountId, id);
  },

  // Expenses
  async listExpenses(accountId: string, options?: { limit?: number; offset?: number }) {
    return expensesService.listAll(accountId, options);
  },
  async createExpense(accountId: string, data: unknown) {
    return expensesService.create(accountId, data as Parameters<typeof expensesService.create>[1]);
  },

  // Budgets
  async listBudgets(accountId: string, options?: { limit?: number; offset?: number }) {
    return budgetsService.listAll(accountId, options);
  },
  async createBudget(accountId: string, data: unknown) {
    return budgetsService.create(accountId, data as Parameters<typeof budgetsService.create>[1]);
  },

  // Ledger
  async listLedgerEntries(accountId: string, options?: { limit?: number; offset?: number }) {
    return ledgersService.listAll(accountId, options);
  },
  async createLedgerEntry(accountId: string, data: unknown) {
    return ledgersService.create(accountId, data as Parameters<typeof ledgersService.create>[1]);
  },
};
