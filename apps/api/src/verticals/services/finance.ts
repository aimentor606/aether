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
  async listInvoices(accountId: string) {
    return invoicesService.listAll(accountId);
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
  async listExpenses(accountId: string) {
    return expensesService.listAll(accountId);
  },
  async createExpense(accountId: string, data: unknown) {
    return expensesService.create(accountId, data as Parameters<typeof expensesService.create>[1]);
  },

  // Budgets
  async listBudgets(accountId: string) {
    return budgetsService.listAll(accountId);
  },
  async createBudget(accountId: string, data: unknown) {
    return budgetsService.create(accountId, data as Parameters<typeof budgetsService.create>[1]);
  },

  // Ledger
  async listLedgerEntries(accountId: string) {
    return ledgersService.listAll(accountId);
  },
  async createLedgerEntry(accountId: string, data: unknown) {
    return ledgersService.create(accountId, data as Parameters<typeof ledgersService.create>[1]);
  },
};
