import * as React from 'react';
import { cn } from '../lib/utils';

export const RadioGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('grid gap-2', className)} role="radiogroup" {...props} />
  ),
);
RadioGroup.displayName = 'RadioGroup';

export const RadioGroupItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      role="radio"
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-primary text-primary shadow focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
RadioGroupItem.displayName = 'RadioGroupItem';
