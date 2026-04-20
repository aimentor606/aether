import { describe, test, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

// Mock resolve-account BEFORE importing anything that depends on it
mock.module('../shared/resolve-account', () => ({
  resolveAccountId: async (userId: string) => `resolved_account_for_${userId}`,
}));

// Now we can safely import the rate limiter
const { tenantRateLimit } = require('../middleware/tenant-rate-limit');

describe('Tenant Rate Limiting', () => {
  function createRateLimitedApp(limit: number) {
    const app = new Hono();
    app.onError((err, c) => {
      if (err instanceof HTTPException) {
        return c.json({ message: err.message }, err.status);
      }
      return c.json({ message: 'Internal server error' }, 500);
    });
    app.use('/test/*', async (c, next) => {
      c.set('accountId', 'rate-test-account');
      await next();
    });
    app.use('/test/*', tenantRateLimit({ limit, windowMs: 60_000 }));
    app.get('/test/ok', (c) => c.json({ ok: true }));
    return app;
  }

  test('allows requests within limit', async () => {
    const app = createRateLimitedApp(5);
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test/ok');
      expect(res.status).toBe(200);
    }
  });

  test('blocks requests over limit with 429', async () => {
    const app = createRateLimitedApp(3);
    for (let i = 0; i < 3; i++) {
      await app.request('/test/ok');
    }
    const res = await app.request('/test/ok');
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toContain('Rate limit');
  });

  test('sets rate limit headers', async () => {
    const app = createRateLimitedApp(5);
    const res = await app.request('/test/ok');
    expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(res.headers.get('X-RateLimit-Remaining')).not.toBeNull();
  });

  test('sets Retry-After header when limited', async () => {
    const app = createRateLimitedApp(1);
    await app.request('/test/ok');
    const res = await app.request('/test/ok');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).not.toBeNull();
  });
});
