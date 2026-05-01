/**
 * Tenant context — extends the request-scoped AsyncLocalStorage with
 * multi-tenant information (verticalId, feature flags, config).
 *
 * The tenant middleware (tenant-config-loader.ts) populates this after auth.
 * Any code in the request lifecycle can call getTenantContext() to access
 * tenant-scoped data without passing Hono's `c` around.
 */

import { setContextField, getRequestContext } from '../lib/request-context';

export interface TenantConfig {
  verticalId: string;
  flags: Record<string, boolean>;
  config: Record<string, unknown>;
}

const TENANT_CONTEXT_KEY = '__tenant';

/**
 * Set the tenant context for the current request.
 * Called by tenantConfigLoader middleware after auth resolves accountId.
 */
export function setTenantContext(tenant: TenantConfig): void {
  const ctx = getRequestContext();
  if (ctx) {
    ctx[TENANT_CONTEXT_KEY] = JSON.stringify(tenant);
    setContextField('verticalId', tenant.verticalId);
  }
}

/**
 * Get the tenant context for the current request.
 * Returns undefined if not in a request or tenant not loaded.
 */
export function getTenantContext(): TenantConfig | undefined {
  const ctx = getRequestContext();
  const raw = ctx?.[TENANT_CONTEXT_KEY];
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as TenantConfig;
  } catch {
    return undefined;
  }
}
