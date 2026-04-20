import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { captureException } from '../lib/sentry';
import { logger as appLogger } from '../lib/logger';
import { BillingError } from '../errors';

export const globalErrorHandler: ErrorHandler = (err, c) => {
  const method = c.req.method;
  const path = c.req.path;
  const errName = err.constructor?.name || 'Error';

  // Suppress SSE/long-poll abort noise — expected timeouts on sandbox proxy
  const isAbort = errName === 'DOMException' || err.message?.includes('The operation was aborted');
  const isSandboxProxy = path.includes('/p/') && path.includes('/global/event');
  if (isAbort && isSandboxProxy) {
    return c.json({ error: true, message: 'Request timeout', status: 504 }, 504);
  }

  if (err instanceof BillingError) {
    appLogger.error(`${method} ${path} -> ${err.statusCode} [BillingError]`, {
      statusCode: err.statusCode, message: err.message, path, method,
    });
    return c.json({ error: err.message }, err.statusCode as any);
  }

  if (err instanceof HTTPException) {
    if (err.status >= 500) {
      captureException(err, { method, path, status: err.status });
    }
    appLogger.error(`${method} ${path} -> ${err.status} [HTTPException]`, {
      status: err.status, message: err.message, path, method,
    });

    const response: Record<string, unknown> = {
      error: true,
      message: err.message,
      status: err.status,
    };

    if (err.status === 503) {
      c.header('Retry-After', '10');
    }

    return c.json(response, err.status);
  }

  const isDbError = errName === 'PostgresError' || (err as any).severity || (err as any).code?.match?.(/^[0-9]{5}$/);
  if (isDbError) {
    const pgErr = err as any;
    captureException(err, {
      method, path, errorType: 'database',
      pgCode: pgErr.code, table: pgErr.table, schema: pgErr.schema_name || pgErr.schema,
    });
    appLogger.error(`${method} ${path} -> 500 [DB ${pgErr.severity || 'ERROR'} ${pgErr.code || '?'}]`, {
      method, path, errorType: 'database',
      pgCode: pgErr.code, table: pgErr.table, hint: pgErr.hint, detail: pgErr.detail,
      message: err.message.split('\n')[0],
    });
  } else {
    captureException(err, { method, path, errorType: errName });
    appLogger.error(`${method} ${path} -> 500 [${errName}] ${err.message}`, {
      method, path, errorType: errName,
      stack: err.stack?.split('\n').slice(0, 5).join('\n'),
    });
  }

  return c.json({ error: true, message: 'Internal server error', status: 500 }, 500);
};

export const notFoundHandler: NotFoundHandler = (c) => {
  return c.json({ error: true, message: 'Not found', status: 404 }, 404);
};
