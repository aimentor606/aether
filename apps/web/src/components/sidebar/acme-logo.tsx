'use client';

import { cn } from '@/lib/utils';

interface AcmeLogoProps {
  size?: number;
  variant?: 'symbol' | 'logomark';
  className?: string;
}

export function AcmeLogo({ size = 24, variant = 'symbol', className }: AcmeLogoProps) {
  // For logomark variant, use logomark-white.svg which is already white
  // and invert it for light mode using CSS (no JS needed)
  if (variant === 'logomark') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/logomark-white.svg"
        alt="Acme"
        className={cn('invert dark:invert-0 flex-shrink-0', className)}
        style={{ height: `${size}px`, width: 'auto' }}
        suppressHydrationWarning
      />
    );
  }

  // Default symbol variant behavior - invert for dark mode
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/acme-symbol.svg"
      alt="Acme"
      className={cn('dark:invert flex-shrink-0', className)}
      style={{ width: `${size}px`, height: `${size}px` }}
      suppressHydrationWarning
    />
  );
}
