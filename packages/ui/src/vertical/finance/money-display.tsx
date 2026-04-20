'use client';

import { cn } from '../../lib/utils';

export interface MoneyDisplayProps {
  /** Numeric amount */
  amount: number | string;
  /** ISO 4217 currency code */
  currency?: string;
  /** Show negative in red */
  colorize?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', KRW: '₩',
};

/**
 * Formatted currency display.
 */
export function MoneyDisplay({ amount, currency = 'USD', colorize = true, className }: MoneyDisplayProps) {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const formatted = `${symbol}${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const isNegative = num < 0;

  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        colorize && isNegative && 'text-red-600',
        colorize && !isNegative && num > 0 && 'text-green-600',
        className,
      )}
    >
      {isNegative ? `-${formatted}` : formatted}
    </span>
  );
}
