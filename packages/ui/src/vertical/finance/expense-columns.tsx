import type { ColumnDef } from './finance-data-table';
import type { ExpenseRecord } from './finance-types';
import { MoneyDisplay } from './money-display';
import { FinanceStatusBadge } from './status-badge';

/**
 * Default column definitions for the expenses table.
 */
export const expenseColumns: ColumnDef<ExpenseRecord>[] = [
  {
    header: 'Expense #',
    accessorKey: 'expenseNumber',
    width: '120px',
  },
  {
    header: 'Employee',
    accessorKey: 'employeeName',
  },
  {
    header: 'Category',
    accessorKey: 'category',
    cell: (row) => row.category.charAt(0).toUpperCase() + row.category.slice(1),
  },
  {
    header: 'Amount',
    align: 'right',
    cell: (row) => <MoneyDisplay amount={row.amount} currency={row.currency} />,
  },
  {
    header: 'Status',
    align: 'center',
    cell: (row) => <FinanceStatusBadge status={row.status} entity="expense" />,
  },
  {
    header: 'Date',
    accessorKey: 'expenseDate',
    width: '120px',
    cell: (row) => new Date(row.expenseDate).toLocaleDateString(),
  },
];
