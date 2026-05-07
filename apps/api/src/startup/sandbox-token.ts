/**
 * Sandbox token injection — ensures a valid AETHER_TOKEN exists in the DB
 * and is synced to the sandbox's environment.
 *
 * Architecture:
 *   Source of truth: aether.api_keys table (hash) + sandboxes.config.serviceKey (plaintext)
 *   Delivery:        POST to sandbox /env API → triple-write (s6 + bootstrap + SecretStore) + auto-restart
 *   Fallback:        docker exec raw write when /env API is unreachable (sandbox still booting)
 *
 * This function is idempotent: if a valid key already exists in the DB AND the
 * sandbox already has it, this is a no-op. It only re-issues when the key is
 * actually missing or invalid.
 */

import { config } from '../config';

export async function injectSandboxToken(sandboxId: string, accountId: string): Promise<void> {
  const { db } = await import('../shared/db');
  const { aetherApiKeys } = await import('@aether/db');
  const { sandboxes } = await import('@aether/db');
  const { eq, and } = await import('drizzle-orm');
  const { execSync: rawExecSync } = await import('child_process');
  const rawDockerHost = config.DOCKER_HOST || process.env.DOCKER_HOST || '';
  const dockerHost = rawDockerHost.startsWith('/') ? `unix://${rawDockerHost}` : rawDockerHost;
  const dockerEnv = { ...process.env, DOCKER_HOST: dockerHost.startsWith('/') ? `unix://${dockerHost}` : dockerHost };
  // Use Docker DNS when on a shared network (self-hosted), localhost when on host (dev)
  const sandboxBaseUrl = config.SANDBOX_NETWORK
    ? `http://${config.SANDBOX_CONTAINER_NAME}:8000`
    : `http://localhost:${config.SANDBOX_PORT_BASE}`;

  // Resolve how sandbox reaches aether-api
  const rawUrl = (config.AETHER_URL || '').replace(/\/v1\/router\/?$/, '');
  let aetherApiUrl = `http://host.docker.internal:${config.PORT}`;
  try {
    const parsed = new URL(rawUrl || `http://localhost:${config.PORT}`);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      parsed.hostname = 'host.docker.internal';
      aetherApiUrl = parsed.toString().replace(/\/$/, '');
    } else if (rawUrl) {
      aetherApiUrl = rawUrl.replace(/\/$/, '');
    }
  } catch { /* keep default */ }

  const { createApiKey, validateSecretKey } = await import('../repositories/api-keys');

  // ─── Resolve the token: reuse existing or create new ───────────────────
  const [sandbox] = await db.select().from(sandboxes).where(eq(sandboxes.sandboxId, sandboxId));
  const existingServiceKey = (sandbox?.config as any)?.serviceKey as string | undefined;
  let token: string;

  if (existingServiceKey) {
    const validation = await validateSecretKey(existingServiceKey).catch(() => ({ isValid: false }));
    if (validation.isValid) {
      token = existingServiceKey;
      console.log('[startup] Reusing existing valid AETHER_TOKEN from sandbox config');
    } else {
      // Key exists in config but not valid in DB — re-issue
      console.log('[startup] Existing AETHER_TOKEN invalid in DB — re-issuing');
      const [oldKey] = await db.select().from(aetherApiKeys)
        .where(and(eq(aetherApiKeys.sandboxId, sandboxId), eq(aetherApiKeys.type, 'sandbox')));
      if (oldKey) await db.delete(aetherApiKeys).where(eq(aetherApiKeys.keyId, oldKey.keyId));
      const newKey = await createApiKey({ sandboxId, accountId, title: 'Sandbox Token', type: 'sandbox' });
      token = newKey.secretKey;
      await db.update(sandboxes)
        .set({ config: { serviceKey: token }, updatedAt: new Date() })
        .where(eq(sandboxes.sandboxId, sandboxId));
    }
  } else {
    // No key at all — first provision
    console.log('[startup] No AETHER_TOKEN in sandbox config — creating');
    const newKey = await createApiKey({ sandboxId, accountId, title: 'Sandbox Token', type: 'sandbox' });
    token = newKey.secretKey;
    await db.update(sandboxes)
      .set({ config: { serviceKey: token }, updatedAt: new Date() })
      .where(eq(sandboxes.sandboxId, sandboxId));
  }

  // ─── Check if sandbox already has the correct token ─────────────────────
  const sandboxAlreadyHasToken = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${sandboxBaseUrl}/env/AETHER_TOKEN`, {
        headers: { Authorization: `Bearer ${config.INTERNAL_SERVICE_KEY}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return false;
      const data = await res.json() as Record<string, string | null>;
      return data?.AETHER_TOKEN === token;
    } catch {
      return false;
    }
  };

  const sandboxAlreadyHasUrl = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${sandboxBaseUrl}/env/AETHER_API_URL`, {
        headers: { Authorization: `Bearer ${config.INTERNAL_SERVICE_KEY}` },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return false;
      const data = await res.json() as Record<string, string | null>;
      return data?.AETHER_API_URL === aetherApiUrl;
    } catch {
      return false;
    }
  };

  // Fast path: if the sandbox already has the correct token AND URL, skip sync.
  const [hasToken, hasUrl] = await Promise.all([
    sandboxAlreadyHasToken(),
    sandboxAlreadyHasUrl(),
  ]);
  if (hasToken && hasUrl) {
    console.log('[startup] Sandbox already has correct AETHER_TOKEN + AETHER_API_URL — skipping sync');
    // Still ensure ONBOARDING_COMPLETE is set for self-hosted mode
    if (config.SANDBOX_NETWORK) {
      try {
        const res = await fetch(`${sandboxBaseUrl}/env/ONBOARDING_COMPLETE`, {
          headers: { Authorization: `Bearer ${config.INTERNAL_SERVICE_KEY}` },
          signal: AbortSignal.timeout(3_000),
        });
        if (res.ok) {
          const data = await res.json() as Record<string, string | null>;
          if (data?.ONBOARDING_COMPLETE !== 'true') {
            await fetch(`${sandboxBaseUrl}/env/ONBOARDING_COMPLETE`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.INTERNAL_SERVICE_KEY}` },
              body: JSON.stringify({ value: 'true' }),
              signal: AbortSignal.timeout(5_000),
            });
            console.log('[startup] Set ONBOARDING_COMPLETE=true for self-hosted');
          }
        }
      } catch { /* non-critical */ }
    }
    return;
  }

  console.log(`[startup] Sandbox needs token sync (hasToken=${hasToken}, hasUrl=${hasUrl})`);

  // ─── Sync token to sandbox ─────────────────────────────────────────────
  const keysToSync: Record<string, string> = {
    AETHER_TOKEN: token,
    AETHER_API_URL: aetherApiUrl,
    TUNNEL_API_URL: aetherApiUrl,
    ...(config.SANDBOX_NETWORK ? { ONBOARDING_COMPLETE: 'true' } : {}),
  };

  const syncViaEnvApi = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${sandboxBaseUrl}/env`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.INTERNAL_SERVICE_KEY}`,
        },
        body: JSON.stringify({ keys: keysToSync }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const result = await res.json() as { restarted?: boolean };
        console.log(`[startup] AETHER_TOKEN synced via /env API (restarted=${result?.restarted ?? 'unknown'})`);
        return true;
      }
      console.warn(`[startup] /env API returned ${res.status} — falling back to docker exec`);
      return false;
    } catch (e: any) {
      console.warn(`[startup] /env API unreachable (${e?.message}) — falling back to docker exec`);
      return false;
    }
  };

  const syncViaDockerExec = (): boolean => {
    try {
      const writes = Object.entries(keysToSync)
        .map(([k, v]) => `printf '%s' '${v}' > /run/s6/container_environment/${k}`)
        .join(' && ');
      rawExecSync(
        `docker exec ${config.SANDBOX_CONTAINER_NAME} bash -c "mkdir -p /run/s6/container_environment && ${writes}"`,
        { stdio: 'pipe', timeout: 15_000, env: dockerEnv },
      );
      // Also write to bootstrap file so token survives container restart
      rawExecSync(
        `docker exec ${config.SANDBOX_CONTAINER_NAME} bash -c 'mkdir -p /workspace/.secrets && cat /workspace/.secrets/.bootstrap-env.json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin) if sys.stdin.readable() else {}; d.update(${JSON.stringify({ AETHER_TOKEN: token, AETHER_API_URL: aetherApiUrl }).replace(/"/g, '\\"')}); print(json.dumps(d))" > /workspace/.secrets/.bootstrap-env.json.tmp && mv /workspace/.secrets/.bootstrap-env.json.tmp /workspace/.secrets/.bootstrap-env.json'`,
        { stdio: 'pipe', timeout: 15_000, env: dockerEnv },
      ).toString();
      console.log('[startup] AETHER_TOKEN synced via docker exec fallback + bootstrap file');
      return true;
    } catch (e: any) {
      console.error(`[startup] docker exec fallback failed: ${e?.message}`);
      return false;
    }
  };

  // Try /env API first, fall back to docker exec
  const synced = await syncViaEnvApi() || syncViaDockerExec();
  if (!synced) {
    console.error('[startup] FATAL: Could not sync AETHER_TOKEN to sandbox. LLM calls will fail with 401.');
  }
}
