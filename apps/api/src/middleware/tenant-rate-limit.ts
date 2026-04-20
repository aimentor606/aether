import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAccountId } from '../verticals/middleware/account-context';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;

const buckets = new Map<string, Bucket>();

function checkAndConsume(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    // Evict oldest if at capacity
    if (buckets.size >= MAX_BUCKETS) {
      let oldest = '';
      let oldestTime = Infinity;
      for (const [k, b] of buckets) {
        if (b.lastRefill < oldestTime) {
          oldestTime = b.lastRefill;
          oldest = k;
        }
      }
      if (oldest) buckets.delete(oldest);
    }
    bucket = { tokens: limit - 1, lastRefill: now };
    buckets.set(key, bucket);
    return { allowed: true, retryAfterMs: 0 };
  }

  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor((elapsed / windowMs) * limit);
  if (refill > 0) {
    bucket.tokens = Math.min(limit, bucket.tokens + refill);
    bucket.lastRefill = now;
  }

  if (bucket.tokens <= 0) {
    return { allowed: false, retryAfterMs: Math.max(windowMs - elapsed, 1000) };
  }

  bucket.tokens--;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Rate limiting middleware scoped by tenant accountId.
 * Usage: app.use('/v1/verticals/*', tenantRateLimit({ limit: 100, windowMs: 60_000 }))
 */
export function tenantRateLimit(opts?: { limit?: number; windowMs?: number }) {
  const limit = opts?.limit ?? DEFAULT_LIMIT;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;

  return async (c: Context, next: Next) => {
    let accountId: string;
    try {
      accountId = await getAccountId(c);
    } catch {
      // No account context (unauthenticated) -- rate limit by IP
      accountId = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'anonymous';
    }

    const result = checkAndConsume(`tenant:${accountId}`, limit, windowMs);
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, result.allowed ? (limit - 1) : 0)));

    if (!result.allowed) {
      c.header('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      throw new HTTPException(429, { message: 'Rate limit exceeded. Try again later.' });
    }

    await next();
  };
}
