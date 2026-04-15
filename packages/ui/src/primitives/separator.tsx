import * as React from 'react';
import { cn } from '../lib/utils';

// TODO: Migrate full component from apps/web/src/components/ui/separator.tsx in Phase 2
export const Separator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />
);
