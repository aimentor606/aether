import * as React from 'react';
import { cn } from '../lib/utils';

export const Slider = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
    />
  ),
);
Slider.displayName = 'Slider';

export const SliderTrack = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('relative h-2 w-full grow overflow-hidden rounded-full bg-secondary', className)} {...props} />
  ),
);
SliderTrack.displayName = 'SliderTrack';

export const SliderRange = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('absolute h-full bg-primary', className)} {...props} />
  ),
);
SliderRange.displayName = 'SliderRange';

export const SliderThumb = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} {...props} />
  ),
);
SliderThumb.displayName = 'SliderThumb';
