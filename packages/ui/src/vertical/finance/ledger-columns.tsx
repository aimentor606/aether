import type { ColumnDef } from './finance-data-table';
import type { LedgerRecord } from './finance-types';
import { MoneyDisplay } from './money-display';
import { FinanceStatusBadge } from './status-badge';

/**
 * Default column definitions for the ledgers table.
 */
export const ledgerColumns: ColumnDef<LedgerRecord>[] = [
  {
    header: 'Entry',
    accessorKey: 'journalEntry',
  },
  {
    header: 'Account',
    accessorKey: 'ledgerAccount',
  },
  {
    header: 'Debit',
    align: 'right',
    cell: (row) => row.debitAmount ? <MoneyDisplay amount={row.debitAmount} /> : '—',
  },
  {
    header: 'Credit',
    align: 'right',
    cell: (row) => row.creditAmount ? <MoneyDisplay amount={row.creditAmount} /> : '—',
  },
  {
    header: 'Status',
    align: 'center',
    cell: (row) => <FinanceStatusBadge status={row.status} entity="ledger" />,
  },
  {
    header: 'Date',
    accessorKey: 'entryDate',
    width: '120px',
    cell: (row) => new Date(row.entryDate).toLocaleDateString(),
  },
  {
    header: 'Reference',
    accessorKey: 'reference',
    cell: (row) => row.reference ?? '—',
  },
];
