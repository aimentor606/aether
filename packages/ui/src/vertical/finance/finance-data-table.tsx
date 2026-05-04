'use client';

import React from 'react';
import { cn } from '../../lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../primitives';
import type { FinanceRecord } from './finance-types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T extends FinanceRecord> {
  /** Column header label */
  header: string;
  /** Key on the record to display (used if no `cell` render fn) */
  accessorKey?: keyof T & string;
  /** Custom cell renderer */
  cell?: (row: T) => React.ReactNode;
  /** Column width (CSS) */
  width?: string;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

export interface FinanceDataTableProps<T extends FinanceRecord> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Row data */
  data: T[];
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS classes */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic finance data table.
 * Works with InvoiceRecord, ExpenseRecord, BudgetRecord, or LedgerRecord.
 */
export function FinanceDataTable<T extends FinanceRecord>({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No records found',
  className,
}: FinanceDataTableProps<T>) {
  return (
    <div className={cn('rounded-md border', className)} data-testid="finance-table">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead
                key={i}
                style={{ width: col.width, textAlign: col.align ?? 'left' }}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow data-testid="finance-empty">
              <TableCell className="text-center text-muted-foreground py-8">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row, rowIdx) => (
              <TableRow
                key={String((row as unknown as { id: string }).id ?? rowIdx)}
                data-testid="finance-row"
                className={onRowClick ? 'cursor-pointer' : undefined}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col, colIdx) => (
                  <TableCell
                    key={colIdx}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.cell
                      ? col.cell(row)
                      : col.accessorKey
                        ? String(row[col.accessorKey] ?? '')
                        : null}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
