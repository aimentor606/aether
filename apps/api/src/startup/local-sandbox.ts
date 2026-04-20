/**
 * Local sandbox registration — auto-registers a local Docker sandbox
 * in the database on startup and syncs the AETHER_TOKEN.
 */

import { config } from '../config';
import { injectSandboxToken } from './sandbox-token';

export async function ensureLocalSandboxRegistered() {
  const { db } = await import('../shared/db');
  const { sandboxes } = await import('@aether/db');
  const { eq } = await import('drizzle-orm');
  const { execSync } = await import('child_process');

  const CONTAINER_NAME = config.SANDBOX_CONTAINER_NAME;
  const portBase = config.SANDBOX_PORT_BASE;
  const baseUrl = `http://localhost:${portBase}`;

  // Helper: check if the Docker container actually exists and is running
  const isContainerRunning = (): boolean => {
    try {
      const rawDockerHost = config.DOCKER_HOST || process.env.DOCKER_HOST || '';
      const dockerHost = rawDockerHost.startsWith('/') ? `unix://${rawDockerHost}` : rawDockerHost;
      const env = { ...process.env, DOCKER_HOST: dockerHost.startsWith('/') ? `unix://${dockerHost}` : dockerHost };
      const out = execSync(`docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME}`, {
        encoding: 'utf-8',
        timeout: 5000,
        env,
      }).trim();
      return out === 'true';
    } catch {
      return false;
    }
  };

  // Check if already registered
  const [existing] = await db
    .select()
    .from(sandboxes)
    .where(eq(sandboxes.externalId, CONTAINER_NAME));

  if (existing) {
    const containerRunning = isContainerRunning();

    if (!containerRunning) {
      console.log(`[startup] Container ${CONTAINER_NAME} not running — skipping (sandbox ${existing.sandboxId} status: ${existing.status})`);
      return;
    }

    // Container is running — ensure DB reflects active status
    if (existing.status !== 'active' || existing.baseUrl !== baseUrl) {
      await db
        .update(sandboxes)
        .set({ status: 'active', baseUrl, updatedAt: new Date() })
        .where(eq(sandboxes.sandboxId, existing.sandboxId));
      console.log(`[startup] Updated local sandbox registration (${existing.sandboxId})`);
    } else {
      console.log(`[startup] Local sandbox already registered (${existing.sandboxId})`);
    }
    await injectSandboxToken(existing.sandboxId, existing.accountId);
    return;
  }

  // No existing sandbox — auto-provision for local single-user setup.
  const { accounts } = await import('@aether/db');
  const [account] = await db.select().from(accounts).limit(1);
  if (!account) {
    console.log('[startup] No account yet — sandbox will be created on first login via POST /init');
    return;
  }

  const containerRunning = isContainerRunning();
  if (!containerRunning) {
    console.log(`[startup] Container ${CONTAINER_NAME} not running — skipping auto-provision (will be created via /init)`);
    return;
  }

  const sandbox = await db
    .insert(sandboxes)
    .values({
      accountId: account.accountId,
      name: 'sandbox-local',
      provider: 'local_docker',
      status: 'active',
      externalId: CONTAINER_NAME,
      baseUrl,
      config: {},
      metadata: {},
    })
    .returning()
    .then(([r]) => r);

  await injectSandboxToken(sandbox.sandboxId, account.accountId);
  console.log(`[startup] Local sandbox auto-provisioned (${sandbox.sandboxId}), token injected`);
}

let localSandboxHealTimer: ReturnType<typeof setInterval> | null = null;
let localSandboxHealRunning = false;

export function startLocalSandboxSelfHeal(): void {
  if (localSandboxHealTimer || !config.isLocalDockerEnabled() || !config.DATABASE_URL) return;

  const run = async () => {
    if (localSandboxHealRunning) return;
    localSandboxHealRunning = true;
    try {
      await ensureLocalSandboxRegistered();
    } catch (err) {
      console.error('[startup] Local sandbox self-heal failed:', err);
    } finally {
      localSandboxHealRunning = false;
    }
  };

  localSandboxHealTimer = setInterval(() => {
    void run();
  }, 60_000);

  console.log('[startup] Local sandbox self-heal started (interval: 60s)');
}
