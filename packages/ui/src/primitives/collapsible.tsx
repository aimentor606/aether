import * as React from 'react';
import { cn } from '../lib/utils';

const Base = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);

export const Collapsible = Base;
export const CollapsibleTrigger = Base;
export const CollapsibleContent = Base;
