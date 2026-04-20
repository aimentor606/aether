/**
 * Sentry edge runtime configuration for Aether Frontend (middleware, edge API routes).
 *
 * Uses @sentry/nextjs SDK pointed at Better Stack's Sentry-compatible endpoint.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_AETHER_ENV || 'dev',

    // Sample 10% of edge transactions
    tracesSampleRate: 0.1,
  });
}
