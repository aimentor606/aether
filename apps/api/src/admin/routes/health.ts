import { Hono } from 'hono';
import type { AppEnv } from '../../types';
import { config } from '../../config';
import { findRepoRoot } from '../services/env';
import { fetchMasterJson } from '../services/sandbox-fetch';

export const healthRoutes = new Hono<AppEnv>();

/** GET /api/health — service health checks */
healthRoutes.get('/api/health', async (c) => {
  const repoRoot = findRepoRoot();
  const checks: Record<string, { ok: boolean; error?: string }> = {};

  checks.api = { ok: true };

  if (!repoRoot) {
    try {
      const health = await fetchMasterJson<{ status: string; runtimeReady?: boolean }>('/kortix/health', {}, 5000);
      checks.sandbox = { ok: true };
      checks.docker = { ok: true };
      // If runtime isn't ready, sandbox is reachable but not fully operational
      if (health.status === 'starting' || health.runtimeReady === false) {
        checks.sandbox = { ok: false, error: 'Sandbox reachable but runtime is still starting' };
      }
    } catch (e: any) {
      checks.sandbox = { ok: false, error: e?.message || String(e) };
      checks.docker = { ok: false, error: e?.message || String(e) };
    }
    return c.json(checks);
  }

  // Local mode — check Docker via execSync (kept sync: quick, infrequent calls)
  const { execSync } = await import('child_process');

  try {
    execSync('docker info', { stdio: 'pipe', timeout: 5000 });
    checks.docker = { ok: true };
  } catch {
    checks.docker = { ok: false, error: 'Docker not running' };
  }

  try {
    const out = execSync(`docker inspect ${config.SANDBOX_CONTAINER_NAME} --format "{{.State.Status}}"`, {
      stdio: 'pipe', timeout: 5000,
    }).toString().trim();
    checks.sandbox = { ok: out === 'running', error: out !== 'running' ? `Status: ${out}` : undefined };
  } catch {
    checks.sandbox = { ok: false, error: 'Container not found' };
  }

  return c.json(checks);
});

/** GET /api/status — system status */
healthRoutes.get('/api/status', async (c) => {
  const cfg = await import('../../config');
  return c.json({
    envMode: config.ENV_MODE,
    internalEnv: config.INTERNAL_AETHER_ENV,
    port: config.PORT,
    sandboxVersion: cfg.SANDBOX_VERSION,
    allowedProviders: config.ALLOWED_SANDBOX_PROVIDERS,
    billingEnabled: config.AETHER_BILLING_INTERNAL_ENABLED,
    daytonaEnabled: config.isDaytonaEnabled(),
    localDockerEnabled: config.isLocalDockerEnabled(),
    databaseConfigured: !!config.DATABASE_URL,
    supabaseConfigured: !!config.SUPABASE_URL,
    stripeConfigured: !!config.STRIPE_SECRET_KEY,
  });
});
