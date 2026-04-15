import * as React from 'react';
import { cn } from '../lib/utils';

// TODO: Migrate full component from apps/web/src/components/ui/checkbox.tsx in Phase 2
export const Checkbox = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />
);
