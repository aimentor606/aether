/**
 * Tenant config loader middleware.
 *
 * Runs after auth middleware. Loads the tenant's vertical config and
 * feature flags from the database, then stores them in AsyncLocalStorage
 * via setTenantContext().
 *
 * Uses an in-memory LRU cache with 5-minute TTL to avoid hitting the DB
 * on every request.
 */

import { Context, Next } from 'hono';
import { db, hasDatabase } from '../shared/db';
import { featureFlags, verticalConfigs } from '@aether/db';
import { eq, and } from 'drizzle-orm';
import { setTenantContext, type TenantConfig } from './tenant-context';

// ─── LRU Cache ────────────────────────────────────────────────────────────────

interface CacheEntry {
  tenant: TenantConfig;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// ── Cache metrics ────────────────────────────────────────────────────────────
let metrics = {
  hits: 0,
  misses: 0,
  evictions: 0,
  expirations: 0,
  size: 0,
};

export function getCacheMetrics() {
  return { ...metrics, size: cache.size };
}

export function resetCacheMetrics() {
  metrics = { hits: 0, misses: 0, evictions: 0, expirations: 0, size: 0 };
}

function getCacheKey(accountId: string): string {
  return `tenant:${accountId}`;
}

function getCached(accountId: string): TenantConfig | null {
  const entry = cache.get(getCacheKey(accountId));
  if (!entry) {
    metrics.misses++;
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(getCacheKey(accountId));
    metrics.expirations++;
    metrics.misses++;
    return null;
  }
  metrics.hits++;
  return entry.tenant;
}

function setCached(accountId: string, tenant: TenantConfig): void {
  // Evict oldest entries if cache is full
  if (cache.size >= MAX_CACHE_SIZE) {
    const firstKey = cache.keys().next().value;
    if (firstKey) {
      cache.delete(firstKey);
      metrics.evictions++;
    }
  }
  cache.set(getCacheKey(accountId), {
    tenant,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ─── Default tenant config (used when no DB config exists) ────────────────────

const DEFAULT_TENANT: TenantConfig = {
  verticalId: 'default',
  flags: {},
  config: {},
};

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Load tenant config after auth.
 *
 * Expects `accountId` to be set in Hono context by a preceding auth middleware.
 * If accountId is not set (e.g., unauthenticated health check), skips tenant loading.
 *
 * For authenticated requests with no DB config, uses DEFAULT_TENANT.
 */
export async function tenantConfigLoader(c: Context, next: Next): Promise<void> {
  const accountId = c.get('accountId') as string | undefined;

  // No account — skip tenant loading (e.g., health checks, public routes)
  if (!accountId) {
    await next();
    return;
  }

  // Check cache first
  const cached = getCached(accountId);
  if (cached) {
    setTenantContext(cached);
    await next();
    return;
  }

  // No DB — use defaults
  if (!hasDatabase) {
    setTenantContext(DEFAULT_TENANT);
    await next();
    return;
  }

  // Load from DB
  try {
    // Load vertical config (take the most recent one for this account)
    const configs = await db
      .select()
      .from(verticalConfigs)
      .where(eq(verticalConfigs.accountId, accountId))
      .limit(1);

    const verticalConfig = configs[0];
    const verticalId = verticalConfig?.verticalId ?? 'default';
    const config = (verticalConfig?.config as Record<string, unknown>) ?? {};

    // Load feature flags for this account + vertical
    const flags = await db
      .select()
      .from(featureFlags)
      .where(
        and(
          eq(featureFlags.accountId, accountId),
          eq(featureFlags.verticalId, verticalId),
        ),
      );

    const flagsMap: Record<string, boolean> = {};
    for (const flag of flags) {
      flagsMap[flag.featureName] = flag.enabled;
    }

    const tenant: TenantConfig = {
      verticalId,
      flags: flagsMap,
      config,
    };

    setCached(accountId, tenant);
    setTenantContext(tenant);
  } catch (error) {
    // Tenant loading failure should not block requests — use defaults
    console.error('[tenantConfigLoader] Failed to load tenant config:', error);
    setTenantContext(DEFAULT_TENANT);
  }

  await next();
}

/**
 * Invalidate the tenant cache for a specific account.
 * Call this when tenant config or feature flags are updated.
 */
export function invalidateTenantCache(accountId: string): void {
  cache.delete(getCacheKey(accountId));
}
