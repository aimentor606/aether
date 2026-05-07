import type { MiddlewareHandler } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { runWithContext, setContextField } from '../lib/request-context';
import { addBreadcrumb } from '../lib/sentry';
import { logger as appLogger } from '../lib/logger';
import { config } from '../config';

// Request context (AsyncLocalStorage) — must be FIRST middleware.
// Wraps the entire request lifecycle so all downstream code gets context fields
// (requestId, userId, accountId, sandboxId) attached to every log.
export const requestContextMiddleware: MiddlewareHandler = async (c, next) => {
  await runWithContext(c.req.method, c.req.path, async () => {
    const path = c.req.path;
    const sbMatch = path.match(/\/sandbox(?:es)?\/([^/]+)/) ||
                    path.match(/\/p\/([^/]+)/);
    if (sbMatch) setContextField('sandboxId', sbMatch[1]);
    await next();
  });
};

// Hono built-in request logger for stdout (Docker captures these)
export const requestLoggerMiddleware: MiddlewareHandler = logger();

// Post-request: Sentry breadcrumbs + slow/error request logging
export const observabilityMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  const status = c.res.status;
  const path = c.req.path;
  const method = c.req.method;

  const userId = c.get('userId');
  const accountId = c.get('accountId');
  if (userId) setContextField('userId', userId);
  if (accountId) setContextField('accountId', accountId);

  addBreadcrumb(`${c.req.method} ${c.req.path} ${status}`, {
    method,
    path,
    status,
    duration,
    userAgent: c.req.header('user-agent')?.slice(0, 100),
  }, 'http');

  const isSandboxProxyPath = path.includes('/v1/p/');
  const isProxyLongPoll = isSandboxProxyPath && path.includes('/global/event');
  const isProxyStartupProbe = isSandboxProxyPath && (
    path.includes('/global/health') ||
    path.includes('/kortix/health') ||
    /\/sessions(?:\/|$)/.test(path)
  );
  const isExpectedProxyNoise = method === 'GET' && (
    (isProxyLongPoll && (
      (status === 200 && duration > 5000) ||
      status === 504 ||
      status === 502 ||
      status === 503
    )) ||
    (isProxyStartupProbe && (status === 502 || status === 503 || status === 504))
  );

  if (!isExpectedProxyNoise && (status >= 500 || duration > 5000)) {
    appLogger.warn(`Slow/error request: ${method} ${path} ${status} ${duration}ms`, {
      status,
      duration,
    });
  }
};

// Pretty JSON in dev mode
export const devPrettyJsonMiddleware: MiddlewareHandler | null =
  config.INTERNAL_AETHER_ENV === 'dev' ? prettyJSON() : null;
