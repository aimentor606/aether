import * as React from 'react';
import { cn } from '../lib/utils';

const Base = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);

export const Popover = Base;
export const PopoverTrigger = Base;
export const PopoverContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none', className)} {...props} />
  ),
);
