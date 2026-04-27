import { logger as appLogger } from '../lib/logger';
import { config } from '../config';
import { ensureSchema } from '../ensure-schema';
import { ensureLocalSandboxRegistered, startLocalSandboxSelfHeal } from './local-sandbox';
import { startSandboxHealthMonitor } from '../platform/services/sandbox-health';
import { startProvisionPoller } from '../platform/services/sandbox-provision-poller';

let schemaReady = false;
export function isSchemaReady() { return schemaReady; }

function startServices(startDeps: {
  startDrainer: () => void;
  startTunnelService: () => void;
  startAutoReplenish: () => void;
  startAccessControlCache: () => void;
}) {
  startDeps.startAccessControlCache();
  startDeps.startDrainer();
  startDeps.startTunnelService();
  startDeps.startAutoReplenish();

  if (config.isLocalDockerEnabled() && config.DATABASE_URL) {
    ensureLocalSandboxRegistered().catch((err) =>
      appLogger.error('[startup] Failed to register local sandbox', err),
    );
    startLocalSandboxSelfHeal();
    startSandboxHealthMonitor();
  }

  if (config.isJustAVPSEnabled()) {
    startProvisionPoller();
  }
}

export function initServices(startDeps: Parameters<typeof startServices>[0]): void {
  ensureSchema()
    .then(() => {
      schemaReady = true;
      startServices(startDeps);
    })
    .catch((err) => {
      appLogger.error('[startup] ensureSchema failed, starting services anyway', err);
      schemaReady = true;
      startServices(startDeps);
    });
}
