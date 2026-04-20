import { Hono } from 'hono';
import type { AppEnv } from '../../types';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { findRepoRoot, parseEnvFile, maskKey, writeEnvFile } from '../services/env';
import { getAdminKeySchema, getAllAdminKeys } from '../services/key-schema';
import { getSandboxEnv, setSandboxEnv } from '../services/sandbox-fetch';

export const envRoutes = new Hono<AppEnv>();

/** GET /api/schema — key schema for the UI */
envRoutes.get('/api/schema', async (c) => {
  return c.json(getAdminKeySchema());
});

/** GET /api/env — read current env values (masked) */
envRoutes.get('/api/env', async (c) => {
  const repoRoot = findRepoRoot();
  const allKeys = getAllAdminKeys();

  if (repoRoot) {
    const rootEnv = await parseEnvFile(resolve(repoRoot, '.env'));
    const sandboxEnv = await parseEnvFile(resolve(repoRoot, 'core/docker/.env'));
    const masked: Record<string, string> = {};
    const configured: Record<string, boolean> = {};

    for (const key of allKeys) {
      const val = rootEnv[key] || sandboxEnv[key] || '';
      masked[key] = maskKey(val);
      configured[key] = !!val;
    }
    return c.json({ masked, configured });
  }

  // Docker mode
  const env = await getSandboxEnv();
  const masked: Record<string, string> = {};
  const configured: Record<string, boolean> = {};
  for (const key of allKeys) {
    const val = env[key] || '';
    masked[key] = maskKey(val);
    configured[key] = !!val;
  }
  return c.json({ masked, configured });
});

/** POST /api/env — save/update env values */
envRoutes.post('/api/env', async (c) => {
  const body = await c.req.json();
  const keys = body?.keys;
  if (!keys || typeof keys !== 'object') {
    return c.json({ error: 'Invalid keys' }, 400);
  }

  const repoRoot = findRepoRoot();

  if (!repoRoot) {
    // Docker mode
    const clean: Record<string, string> = {};
    for (const [k, v] of Object.entries(keys)) {
      if (typeof v !== 'string') continue;
      const trimmed = v.trim();
      if (!trimmed) continue;
      clean[k] = trimmed;
    }
    try {
      await setSandboxEnv(clean);
      return c.json({ ok: true });
    } catch (e: any) {
      return c.json({ ok: false, error: 'Failed to save', details: e?.message || String(e) }, 500);
    }
  }

  // Repo mode — write to .env files
  const rootData: Record<string, string> = {};
  const sandboxData: Record<string, string> = {};
  const { ALL_SANDBOX_ENV_KEYS } = await import('../../providers/registry');

  for (const [key, val] of Object.entries(keys)) {
    if (typeof val !== 'string') continue;
    rootData[key] = val;
    if (ALL_SANDBOX_ENV_KEYS.has(key)) {
      sandboxData[key] = val;
    }
  }

  const rootEnvPath = resolve(repoRoot, '.env');
  if (!existsSync(rootEnvPath)) {
    const examplePath = resolve(repoRoot, '.env.example');
    if (existsSync(examplePath)) {
      writeFileSync(rootEnvPath, readFileSync(examplePath, 'utf-8'));
    } else {
      writeFileSync(rootEnvPath, '# Aether Environment Configuration\nENV_MODE=local\n');
    }
  }

  await writeEnvFile(rootEnvPath, rootData);

  if (Object.keys(sandboxData).length > 0) {
    const sandboxEnvPath = resolve(repoRoot, 'core/docker/.env');
    if (!existsSync(sandboxEnvPath)) {
      const examplePath = resolve(repoRoot, 'core/docker/.env.example');
      if (existsSync(examplePath)) {
        writeFileSync(sandboxEnvPath, readFileSync(examplePath, 'utf-8'));
      } else {
        writeFileSync(sandboxEnvPath, '# Aether Sandbox Environment\nENV_MODE=local\n');
      }
    }
    await writeEnvFile(sandboxEnvPath, sandboxData);
  }

  // Re-run setup-env.sh to propagate (kept sync for now — quick shell script)
  try {
    const { execSync } = await import('child_process');
    execSync('bash scripts/setup-env.sh', { cwd: repoRoot, stdio: 'pipe', timeout: 15000 });
  } catch (e: any) {
    console.error('[admin] setup-env.sh failed:', e.message);
  }

  return c.json({ ok: true });
});
