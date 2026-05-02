// ─── Observability (must be first — instruments before other imports) ────────
import './lib/sentry';
import { logger as appLogger } from './lib/logger';

import { Hono } from 'hono';
import { config } from './config';
import { connectRedis } from './shared/redis';

// ─── Sub-Service Imports ────────────────────────────────────────────────────

import { router } from './router';
import { billingApp } from './billing';
import { platformApp } from './platform';
import { sandboxProxyApp } from './sandbox-proxy';
import { setupApp } from './setup';
import { providersApp } from './providers/routes';
import { secretsApp } from './secrets/routes';
import { integrationsApp } from './integrations';
import { queueApp, startDrainer, stopDrainer } from './queue';
import { serversApp } from './servers';
import { combinedAuth } from './middleware/auth';
import { initModelPricing, stopModelPricing } from './router/config/model-pricing';
import { tunnelApp, startTunnelService, stopTunnelService } from './tunnel';
import { stopSandboxHealthMonitor } from './platform/services/sandbox-health';
import { stopProvisionPoller } from './platform/services/sandbox-provision-poller';
import { startAutoReplenish, stopAutoReplenish } from './pool';
import { accessControlApp } from './access-control';
import { startAccessControlCache, stopAccessControlCache } from './shared/access-control-cache';
import { legacyApp } from './legacy';
import { credentialsApp } from './router/routes/credentials';
import { adminApp } from './admin';
import { sandboxPoolAdminApp } from './platform/routes/sandbox-pool-admin';
import { oauthApp } from './oauth';
import { verticalsApp } from './verticals';
import { tenantRateLimit } from './middleware/tenant-rate-limit';
import { tenantConfigLoader } from './middleware/tenant-config-loader';
import { corsMiddleware } from './middleware/cors-config';
import { requestContextMiddleware, requestLoggerMiddleware, observabilityMiddleware, devPrettyJsonMiddleware } from './middleware/global';
import { globalErrorHandler, notFoundHandler } from './middleware/error-handler';
import { createDb, withTenantContext } from '@aether/db';
import { createTenantRlsMiddleware } from './middleware/tenant-rls';

// ─── Extracted Route Modules ────────────────────────────────────────────────

import { healthApp } from './routes/health';
import { accountsApp } from './routes/accounts';
import { userRolesApp } from './routes/user-roles';

// ─── Extracted Startup Modules ──────────────────────────────────────────────

import { printStartupBanner } from './startup/banner';
import { initServices } from './startup/services';
import { createShutdown } from './startup/shutdown';
import { createServerConfig } from './server';

// ─── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono();

// Non-blocking Redis — server starts even if Redis is slow/unavailable.
connectRedis().catch((err) =>
  appLogger.error('[startup] Redis connection failed (routes will retry)', err),
);

// === Global Middleware ===

app.use('*', corsMiddleware);
app.use('*', requestContextMiddleware);
app.use('*', requestLoggerMiddleware);
app.use('*', observabilityMiddleware);
if (devPrettyJsonMiddleware) app.use('*', devPrettyJsonMiddleware);

const rlsDb = config.DATABASE_URL ? createDb(config.DATABASE_URL) : null;

// ─── Mount Extracted Routes ─────────────────────────────────────────────────

app.route('/', healthApp);
app.route('/v1/accounts', accountsApp);
app.route('/v1/user-roles', userRolesApp);

// ─── Mount Sub-Services ─────────────────────────────────────────────────────

app.route('/v1/router', router);
app.route('/v1/billing', billingApp);
app.route('/v1/platform', platformApp);
if (config.AETHER_DEPLOYMENTS_ENABLED) {
  const { deploymentsApp } = await import('./deployments');
  app.route('/v1/deployments', deploymentsApp);
}
app.route('/v1/pipedream', integrationsApp);
app.route('/v1/access', accessControlApp);
app.route('/v1/legacy', legacyApp);

if (config.isLocal()) {
  app.route('/v1/setup', setupApp);
}
app.route('/v1/admin', adminApp);
app.route('/v1/admin/sandbox-pool', sandboxPoolAdminApp);
app.route('/v1/oauth', oauthApp);

// Verticals — multi-tenant vertical-specific routes (require auth + tenant context + rate limit + RLS)
app.use('/v1/verticals/*', combinedAuth);
app.use('/v1/verticals/*', tenantConfigLoader);
app.use('/v1/verticals/*', tenantRateLimit({ limit: 100, windowMs: 60_000 }));
app.use('/v1/verticals/*', createTenantRlsMiddleware(rlsDb, withTenantContext));

// Control plane — credential issuance and control-only operations
app.use('/v1/control/*', combinedAuth);
app.route('/v1/control', credentialsApp);

if (config.RECONCILIATION_ENABLED) {
  const RECONCILE_INTERVAL_MS = 30_000;
  import('./router/services/spend-reconciler').then(({ reconcileSpend }) => {
    appLogger.info('[Reconciler] Spend reconciliation enabled, polling every 30s');
    setInterval(async () => {
      try {
        const result = await reconcileSpend();
        if (result.processed > 0 || result.errors > 0) {
          appLogger.info(`[Reconciler] processed=${result.processed} skipped=${result.skipped} errors=${result.errors}`);
        }
      } catch (err) {
        appLogger.error('[Reconciler] Interval error', { error: String(err) });
      }
    }, RECONCILE_INTERVAL_MS);
  }).catch((err) => {
    appLogger.error('[Reconciler] Failed to load spend-reconciler module', err);
  });
}

app.route('/v1/verticals', verticalsApp);

// Authenticated routes
app.use('/v1/providers/*', combinedAuth);
app.route('/v1/providers', providersApp);

app.use('/v1/secrets/*', combinedAuth);
app.route('/v1/secrets', secretsApp);

app.use('/v1/servers/*', combinedAuth);
app.route('/v1/servers', serversApp);

app.use('/v1/queue/*', combinedAuth);
app.route('/v1/queue', queueApp);

// Public device-auth endpoints (no auth — CLI uses these)
import { createDeviceAuthPublicRouter } from './tunnel/routes/device-auth';
app.route('/v1/tunnel/device-auth', createDeviceAuthPublicRouter());

app.use('/v1/tunnel/*', async (c, next) => {
  const path = c.req.path.replace('/v1/tunnel/device-auth', '');
  if (c.req.path.startsWith('/v1/tunnel/device-auth')) {
    if (c.req.method === 'POST' && (path === '' || path === '/')) return next();
    if (c.req.method === 'GET' && path.endsWith('/status')) return next();
  }
  return combinedAuth(c, next);
});
app.route('/v1/tunnel', tunnelApp);

// Aether API — proxies /v1/aether/* to sandbox's /aether/*
import { aetherProxyHandler } from './routes/aether-projects';
app.use('/v1/aether/*', combinedAuth);
app.use('/v1/aether', combinedAuth);
app.all('/v1/aether/*', aetherProxyHandler);
app.all('/v1/aether', aetherProxyHandler);

app.route('/v1/p', sandboxProxyApp);

// === Error Handling ===

app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// ─── Startup ────────────────────────────────────────────────────────────────

printStartupBanner();

initModelPricing().catch((err) =>
  console.error('[startup] Model pricing init failed (will retry in 24h):', err),
);

initServices({
  startDrainer,
  startTunnelService,
  startAutoReplenish,
  startAccessControlCache,
});

createShutdown({
  stopDrainer,
  stopModelPricing,
  stopTunnelService,
  stopSandboxHealthMonitor,
  stopProvisionPoller,
  stopAutoReplenish,
  stopAccessControlCache,
});

// ─── Bun Server Export ──────────────────────────────────────────────────────

export default createServerConfig(app);
