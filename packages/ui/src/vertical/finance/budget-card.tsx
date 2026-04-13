'use client';

import { cn } from '../../lib/utils';
import { Card, CardContent } from '../../primitives';
import { MoneyDisplay } from './money-display';
import { FinanceStatusBadge } from './status-badge';
import type { BudgetRecord } from './finance-types';

export interface BudgetCardProps {
  budget: BudgetRecord;
  onClick?: () => void;
  className?: string;
}

/**
 * Budget progress card showing spent vs total with a visual bar.
 */
export function BudgetCard({ budget, onClick, className }: BudgetCardProps) {
  const total = parseFloat(budget.totalBudget);
  const spent = parseFloat(budget.spent);
  const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0;
  const isOver = spent > total;

  return (
    <Card
      className={cn('cursor-pointer transition-shadow hover:shadow-md', className)}
      onClick={onClick}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-sm">{budget.budgetName}</h3>
            {budget.departmentName && (
              <p className="text-xs text-muted-foreground">{budget.departmentName}</p>
            )}
          </div>
          <FinanceStatusBadge status={budget.status} entity="budget" />
        </div>

        {/* Amounts */}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">
            <MoneyDisplay amount={spent} currency={budget.currency} colorize={false} />
            {' / '}
            <MoneyDisplay amount={total} currency={budget.currency} colorize={false} />
          </span>
          <span className={cn('font-medium', isOver ? 'text-red-600' : 'text-foreground')}>
            {pct.toFixed(0)}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              isOver ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-primary',
            )}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        {/* Period + dates */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="capitalize">{budget.period}</span>
          <span>
            {new Date(budget.startDate).toLocaleDateString()} – {new Date(budget.endDate).toLocaleDateString()}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
