'use client';

import { cn } from '@/lib/utils';

import { INSTANCE_CONFIG, type RegionId } from './config';

export const LOCATIONS = INSTANCE_CONFIG.regions;
export type LocationId = RegionId;

export function RegionToggle({
  location,
  onLocationChange,
  className,
}: {
  location: string;
  onLocationChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 p-1 rounded-full bg-muted/40 border border-border/30 w-fit',
        className,
      )}
    >
      {LOCATIONS.map((loc) => (
        <button
          key={loc.id}
          type="button"
          onClick={() => onLocationChange(loc.id)}
          className={cn(
            'px-5 py-1.5 rounded-full text-[13px] font-medium transition-colors cursor-pointer',
            location === loc.id
              ? 'bg-foreground text-background shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {loc.shorthand}
        </button>
      ))}
    </div>
  );
}
