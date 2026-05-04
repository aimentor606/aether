'use client';

import { cn } from '../../lib/utils';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  danger: 'bg-red-100 text-red-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

// ─── Status → variant mapping ────────────────────────────────────────────────

const invoiceStatusMap: Record<string, StatusVariant> = {
  draft: 'neutral',
  sent: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'neutral',
};

const expenseStatusMap: Record<string, StatusVariant> = {
  draft: 'neutral',
  submitted: 'info',
  approved: 'success',
  reimbursed: 'success',
  rejected: 'danger',
};

const budgetStatusMap: Record<string, StatusVariant> = {
  draft: 'neutral',
  active: 'info',
  completed: 'success',
  archived: 'neutral',
};

const ledgerStatusMap: Record<string, StatusVariant> = {
  posted: 'success',
  draft: 'neutral',
  reversed: 'warning',
};

export interface FinanceStatusBadgeProps {
  status: string;
  /** Which entity type — controls color mapping */
  entity?: 'invoice' | 'expense' | 'budget' | 'ledger';
  className?: string;
}

function getStatusVariant(status: string, entity?: string): StatusVariant {
  if (entity === 'invoice') return invoiceStatusMap[status] ?? 'neutral';
  if (entity === 'expense') return expenseStatusMap[status] ?? 'neutral';
  if (entity === 'budget') return budgetStatusMap[status] ?? 'neutral';
  if (entity === 'ledger') return ledgerStatusMap[status] ?? 'neutral';
  return 'neutral';
}

/**
 * Finance entity status badge with color coding.
 */
export function FinanceStatusBadge({ status, entity, className }: FinanceStatusBadgeProps) {
  const variant = getStatusVariant(status, entity);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        variantStyles[variant],
        className,
      )}
      data-testid="status-badge"
    >
      {status}
    </span>
  );
}
