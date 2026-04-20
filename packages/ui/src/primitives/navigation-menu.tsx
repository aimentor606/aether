import * as React from 'react';
import { cn } from '../lib/utils';

const Base = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />,
);

export const NavigationMenu = Base;
export const NavigationMenuList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-1', className)} {...props} />
  ),
);
export const NavigationMenuItem = Base;
export const NavigationMenuTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} className={cn('group inline-flex items-center justify-center gap-1 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent', className)} {...props} />
  ),
);
export const NavigationMenuContent = Base;
export const NavigationMenuLink = React.forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement>>(
  ({ className, ...props }, ref) => (
    <a ref={ref} className={cn('block select-none rounded-md p-2 text-sm hover:bg-accent', className)} {...props} />
  ),
);
