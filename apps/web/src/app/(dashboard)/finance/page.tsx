'use client';

import { useState } from 'react';
import { useApiClient, useFinance } from '@aether/sdk/client';
import {
  FinanceDataTable,
  invoiceColumns,
  expenseColumns,
  budgetColumns,
  ledgerColumns,
  BudgetCard,
} from '@aether/ui/vertical/finance';
import type {
  InvoiceRecord,
  ExpenseRecord,
  BudgetRecord,
  LedgerRecord,
} from '@aether/ui/vertical/finance';

type TabKey = 'invoices' | 'expenses' | 'budgets' | 'ledgers';

const tabs: { key: TabKey; label: string }[] = [
  { key: 'invoices', label: 'Invoices' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'ledgers', label: 'Ledgers' },
];

export default function FinancePage() {
  const client = useApiClient();
  const finance = useFinance(client);
  const [activeTab, setActiveTab] = useState<TabKey>('invoices');

  return (
    <div className="flex flex-col h-full w-full" data-testid="finance-page">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold" data-testid="finance-heading">Finance</h1>
        <p className="text-sm text-muted-foreground">
          Manage invoices, expenses, budgets, and ledgers
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b px-6 pt-2">
        {tabs.map((tab) => {
          const data = finance[tab.key];
          const count = data.data?.length;
          return (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {count !== undefined && ` (${count})`}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6" data-testid="finance-tab-content">
        {activeTab === 'invoices' && (
          <FinanceDataTable<InvoiceRecord>
            columns={invoiceColumns}
            data={(finance.invoices.data ?? []) as unknown as InvoiceRecord[]}
            emptyMessage="No invoices yet"
          />
        )}

        {activeTab === 'expenses' && (
          <FinanceDataTable<ExpenseRecord>
            columns={expenseColumns}
            data={(finance.expenses.data ?? []) as unknown as ExpenseRecord[]}
            emptyMessage="No expenses yet"
          />
        )}

        {activeTab === 'budgets' &&
          ((finance.budgets.data ?? []).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(finance.budgets.data as unknown as BudgetRecord[]).map(
                (budget) => (
                  <BudgetCard key={budget.id} budget={budget} />
                ),
              )}
            </div>
          ) : (
            <FinanceDataTable<BudgetRecord>
              columns={budgetColumns}
              data={[]}
              emptyMessage="No budgets yet"
            />
          ))}

        {activeTab === 'ledgers' && (
          <FinanceDataTable<LedgerRecord>
            columns={ledgerColumns}
            data={(finance.ledgers.data ?? []) as unknown as LedgerRecord[]}
            emptyMessage="No ledger entries yet"
          />
        )}
      </div>
    </div>
  );
}
