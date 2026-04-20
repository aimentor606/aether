import type { ColumnDef } from './finance-data-table';
import type { BudgetRecord } from './finance-types';
import { MoneyDisplay } from './money-display';
import { FinanceStatusBadge } from './status-badge';

/**
 * Default column definitions for the budgets table.
 */
export const budgetColumns: ColumnDef<BudgetRecord>[] = [
  {
    header: 'Budget',
    accessorKey: 'budgetName',
  },
  {
    header: 'Period',
    accessorKey: 'period',
    cell: (row) => row.period.charAt(0).toUpperCase() + row.period.slice(1),
  },
  {
    header: 'Total',
    align: 'right',
    cell: (row) => <MoneyDisplay amount={row.totalBudget} currency={row.currency} />,
  },
  {
    header: 'Spent',
    align: 'right',
    cell: (row) => <MoneyDisplay amount={row.spent} currency={row.currency} />,
  },
  {
    header: 'Status',
    align: 'center',
    cell: (row) => <FinanceStatusBadge status={row.status} entity="budget" />,
  },
  {
    header: 'Dates',
    width: '160px',
    cell: (row) => (
      <span className="text-xs text-muted-foreground">
        {new Date(row.startDate).toLocaleDateString()} – {new Date(row.endDate).toLocaleDateString()}
      </span>
    ),
  },
];
