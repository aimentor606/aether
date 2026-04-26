import { describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';
import { createTenantRlsMiddleware } from '../middleware/tenant-rls';

type Variables = { accountId?: string };

describe('createTenantRlsMiddleware', () => {
  test('invokes withTenantContext when accountId exists', async () => {
    const db = {
      transaction: async <T>(
        callback: (tx: { execute: (query: string | { getSQL: () => unknown }) => Promise<unknown[]> }) => Promise<T>,
      ): Promise<T> => callback({ execute: async () => [] }),
    };

    const withTenantContextSpy = mock(async (_db: unknown, _accountId: string, callback: () => Promise<unknown>) => {
      return callback();
    });

    const app = new Hono<{ Variables: Variables }>();
    app.use('/v1/verticals/*', async (c, next) => {
      c.set('accountId', 'acct-123');
      await next();
    });
    app.use('/v1/verticals/*', createTenantRlsMiddleware(db as any, withTenantContextSpy as any));
    app.get('/v1/verticals/finance/invoices', (c) => c.json({ ok: true }));

    const res = await app.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(200);
    expect(withTenantContextSpy).toHaveBeenCalledTimes(1);
    expect(withTenantContextSpy.mock.calls[0]?.[1]).toBe('acct-123');
  });

  test('falls through when accountId missing', async () => {
    const db = {
      transaction: async <T>(
        callback: (tx: { execute: (query: string | { getSQL: () => unknown }) => Promise<unknown[]> }) => Promise<T>,
      ): Promise<T> => callback({ execute: async () => [] }),
    };

    const withTenantContextSpy = mock(async (_db: unknown, _accountId: string, callback: () => Promise<unknown>) => {
      return callback();
    });

    const app = new Hono<{ Variables: Variables }>();
    app.use('/v1/verticals/*', createTenantRlsMiddleware(db as any, withTenantContextSpy as any));
    app.get('/v1/verticals/finance/invoices', (c) => c.json({ ok: true }));

    const res = await app.request('/v1/verticals/finance/invoices');
    expect(res.status).toBe(200);
    expect(withTenantContextSpy).toHaveBeenCalledTimes(0);
  });
});
