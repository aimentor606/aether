/**
 * Finance UI — shared types for invoice/expense/budget/ledger records.
 * Mirrors the DB schema from @aether/db/schema/finance but as plain interfaces
 * for use in the UI layer without importing Drizzle types.
 */

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

export type FinanceRecord = InvoiceRecord | ExpenseRecord | BudgetRecord | LedgerRecord;
