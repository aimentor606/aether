import * as React from 'react';
import { cn } from '../lib/utils';

const Base = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);

export const AlertDialog = Base;
export const AlertDialogTrigger = Base;
export const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('fixed inset-0 z-50 flex items-center justify-center', className)} {...props} />
  ),
);
export const AlertDialogHeader = Base;
export const AlertDialogTitle = Base;
export const AlertDialogDescription = Base;
export const AlertDialogFooter = Base;
export const AlertDialogAction = Base;
export const AlertDialogCancel = Base;
