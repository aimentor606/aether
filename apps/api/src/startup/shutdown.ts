import { logger as appLogger } from '../lib/logger';
import { flushSentry } from '../lib/sentry';

export function createShutdown(stopDeps: {
  stopDrainer: () => void;
  stopModelPricing: () => void;
  stopTunnelService: () => void;
  stopSandboxHealthMonitor: () => void;
  stopProvisionPoller: () => void;
  stopAutoReplenish: () => void;
  stopAccessControlCache: () => void;
}) {
  async function shutdown(signal: string) {
    appLogger.info(`Shutting down gracefully`, { signal });
    stopDeps.stopDrainer();
    stopDeps.stopModelPricing();
    stopDeps.stopTunnelService();
    stopDeps.stopSandboxHealthMonitor();
    stopDeps.stopProvisionPoller();
    stopDeps.stopAutoReplenish();
    stopDeps.stopAccessControlCache();
    await Promise.allSettled([appLogger.flush(), flushSentry()]);
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
