import type { ColumnDef } from './finance-data-table';
import type { InvoiceRecord } from './finance-types';
import { MoneyDisplay } from './money-display';
import { FinanceStatusBadge } from './status-badge';

/**
 * Default column definitions for the invoices table.
 */
export const invoiceColumns: ColumnDef<InvoiceRecord>[] = [
  {
    header: 'Invoice #',
    accessorKey: 'invoiceNumber',
    width: '120px',
  },
  {
    header: 'Client',
    accessorKey: 'clientName',
  },
  {
    header: 'Amount',
    align: 'right',
    cell: (row) => <MoneyDisplay amount={row.amount} currency={row.currency} />,
  },
  {
    header: 'Status',
    align: 'center',
    cell: (row) => <FinanceStatusBadge status={row.status} entity="invoice" />,
  },
  {
    header: 'Due Date',
    accessorKey: 'dueDate',
    width: '120px',
    cell: (row) => row.dueDate ? new Date(row.dueDate).toLocaleDateString() : '—',
  },
  {
    header: 'Issued',
    accessorKey: 'issuedDate',
    width: '120px',
    cell: (row) => new Date(row.issuedDate).toLocaleDateString(),
  },
];
