'use client';

import { useEffect } from 'react';
import { RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as Sentry from '@sentry/nextjs';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Aether Auth Error]', error);
    Sentry.captureException(error, { tags: { route_group: 'auth' } });
  }, [error]);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="text-4xl">⚠️</div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold text-foreground">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground">
            {error.message?.length < 200
              ? error.message
              : 'Something went wrong during authentication. Please try again.'}
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <Button className="w-full" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
            Try Again
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <a href="/auth">
              <ArrowLeft className="h-4 w-4" />
              Back to Login
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
