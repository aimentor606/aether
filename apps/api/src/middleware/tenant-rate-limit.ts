import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getAccountId } from '../verticals/middleware/account-context';
import { getRedisClient, isRedisConfigured } from '../shared/redis';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

interface RateLimitCheckResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
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

async function checkAndConsumeRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitCheckResult | null> {
  if (!isRedisConfigured()) {
    return null;
  }

  const redis = getRedisClient();
  if (!redis) {
    return null;
  }

  const currentWindow = Math.floor(Date.now() / windowMs);
  const windowKey = `${key}:${currentWindow}`;
  const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  try {
    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.expire(windowKey, ttlSeconds);
    }

    const ttl = await redis.ttl(windowKey);
    const retryAfterMs = ttl > 0 ? ttl * 1000 : windowMs;
    const allowed = count <= limit;
    const remaining = Math.max(0, limit - count);

    return {
      allowed,
      remaining,
      retryAfterMs: allowed ? 0 : retryAfterMs,
    };
  } catch (error) {
    console.warn('[tenant-rate-limit] redis rate-limit check failed, using in-memory fallback', error);
    return null;
  }
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

    const rateLimitKey = `tenant:${accountId}`;
    const redisResult = await checkAndConsumeRedis(rateLimitKey, limit, windowMs);
    const inMemoryResult = redisResult
      ? null
      : checkAndConsume(rateLimitKey, limit, windowMs);

    const allowed = redisResult ? redisResult.allowed : Boolean(inMemoryResult?.allowed);
    const remaining = redisResult
      ? redisResult.remaining
      : Math.max(0, allowed ? limit - 1 : 0);
    const retryAfterMs = redisResult
      ? redisResult.retryAfterMs
      : (inMemoryResult?.retryAfterMs ?? 0);

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      c.header('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
      throw new HTTPException(429, { message: 'Rate limit exceeded. Try again later.' });
    }

    await next();
  };
}
