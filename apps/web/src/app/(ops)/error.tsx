'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw, Home, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function OpsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Aether Ops Error]', error);
    Sentry.captureException(error, { tags: { route_group: 'ops' } });
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] w-full items-center justify-center px-4">
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-foreground">Admin Error</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {error.message?.length < 200
              ? error.message
              : 'An unexpected error occurred in the admin panel.'}
          </p>
        </div>

        <div className="flex w-full gap-3">
          <Button className="flex-1" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
