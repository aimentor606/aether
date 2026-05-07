'use client';

import { useEffect } from 'react';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function CheckoutError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Aether Checkout Error]', error);
    Sentry.captureException(error, { tags: { route_group: 'checkout' } });
  }, [error]);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Checkout Error
          </h1>
          <p className="text-sm text-muted-foreground">
            {error.message?.length < 200
              ? error.message
              : 'Something went wrong during checkout. Your payment was not processed.'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button className="w-full" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <a href="/instances">
              <ArrowLeft className="h-4 w-4" />
              Back to Instances
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
