import * as React from 'react';
import { cn } from '../lib/utils';

const Base = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);

export const Accordion = Base;
export const AccordionItem = Base;
export const AccordionTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn('flex w-full items-center justify-between', className)} {...props} />
  ),
);
export const AccordionContent = Base;
