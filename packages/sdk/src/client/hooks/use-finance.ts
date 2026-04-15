import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Record types (mirror @aether/db schema) ────────────────────────────────────

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  description?: string;
  amount: string;
  currency: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  dueDate?: string;
  issuedDate: string;
  paidDate?: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  employeeName: string;
  category: 'travel' | 'meals' | 'equipment' | 'software' | 'utilities' | 'rent' | 'salary' | 'marketing' | 'other';
  description?: string;
  amount: string;
  currency: string;
  status: 'draft' | 'submitted' | 'approved' | 'reimbursed' | 'rejected';
  expenseDate: string;
  createdAt: string;
}

export interface BudgetRecord {
  id: string;
  budgetName: string;
  period: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  totalBudget: string;
  spent: string;
  currency: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  startDate: string;
  endDate: string;
  departmentName?: string;
}

export interface LedgerRecord {
  id: string;
  journalEntry: string;
  debitAmount: string | null;
  creditAmount: string | null;
  ledgerAccount: string;
  description?: string;
  status: 'posted' | 'draft' | 'reversed';
  entryDate: string;
  reference?: string;
  createdAt: string;
}

// ─── Hooks factory ────────────────────────────────────────────────────────────

/**
 * Create finance hooks bound to an ApiClient.
 *
 * Usage:
 * ```tsx
 * const client = useApiClient();
 * const { invoices, createInvoice } = useFinance(client);
 * ```
 */
export function useFinance(client: ApiClient) {
  const queryClient = useQueryClient();

  // ─── Invoices ───────────────────────────────────────────────────────────

  const invoices = useQuery<InvoiceRecord[]>({
    queryKey: ['finance', 'invoices'],
    queryFn: async () => {
      const res = await client.get<InvoiceRecord[]>('/finance/invoices');
      return res.data ?? [];
    },
  });

  const createInvoice = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await client.post<InvoiceRecord>('/finance/invoices', data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });

  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      return client.delete(`/finance/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'invoices'] });
    },
  });

  // ─── Expenses ───────────────────────────────────────────────────────────

  const expenses = useQuery<ExpenseRecord[]>({
    queryKey: ['finance', 'expenses'],
    queryFn: async () => {
      const res = await client.get<ExpenseRecord[]>('/finance/expenses');
      return res.data ?? [];
    },
  });

  const createExpense = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await client.post<ExpenseRecord>('/finance/expenses', data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'expenses'] });
    },
  });

  // ─── Budgets ────────────────────────────────────────────────────────────

  const budgets = useQuery<BudgetRecord[]>({
    queryKey: ['finance', 'budgets'],
    queryFn: async () => {
      const res = await client.get<BudgetRecord[]>('/finance/budgets');
      return res.data ?? [];
    },
  });

  const createBudget = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await client.post<BudgetRecord>('/finance/budgets', data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
    },
  });

  // ─── Ledgers ────────────────────────────────────────────────────────────

  const ledgers = useQuery<LedgerRecord[]>({
    queryKey: ['finance', 'ledgers'],
    queryFn: async () => {
      const res = await client.get<LedgerRecord[]>('/finance/ledgers');
      return res.data ?? [];
    },
  });

  const createLedger = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await client.post<LedgerRecord>('/finance/ledgers', data);
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'ledgers'] });
    },
  });

  return {
    invoices,
    createInvoice,
    deleteInvoice,
    expenses,
    createExpense,
    budgets,
    createBudget,
    ledgers,
    createLedger,
  };
}
