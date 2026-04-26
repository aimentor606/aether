// ─── Observability (must be first — instruments before other imports) ────────
import './lib/sentry';
import { flushSentry } from './lib/sentry';
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
// WoA is now mounted under the router at /v1/router/woa (see router/index.ts)
import { supabaseAuth, combinedAuth } from './middleware/auth';
import { ensureSchema } from './ensure-schema';
import { initModelPricing, stopModelPricing } from './router/config/model-pricing';
import { tunnelApp, wsHandlers as tunnelWsHandlers, startTunnelService, stopTunnelService, getTunnelServiceStatus } from './tunnel';
import { startSandboxHealthMonitor, stopSandboxHealthMonitor } from './platform/services/sandbox-health';
import { startProvisionPoller, stopProvisionPoller } from './platform/services/sandbox-provision-poller';
import { startAutoReplenish, stopAutoReplenish } from './pool';
import { accessControlApp } from './access-control';
import { startAccessControlCache, stopAccessControlCache } from './shared/access-control-cache';
import { legacyApp } from './legacy';
import { credentialsApp } from './router/routes/credentials';
// [channels v2] Old channel routes removed — channels now managed via sandbox CLI (kchannel, ktelegram, kslack)
import { adminApp } from './admin';
import { sandboxPoolAdminApp } from './platform/routes/sandbox-pool-admin';
import { oauthApp } from './oauth';
import { verticalsApp } from './verticals';
import { tenantRateLimit } from './middleware/tenant-rate-limit';
import { tenantConfigLoader } from './middleware/tenant-config-loader';
import { corsMiddleware } from './middleware/cors-config';
import { requestContextMiddleware, requestLoggerMiddleware, observabilityMiddleware, devPrettyJsonMiddleware } from './middleware/global';
import { globalErrorHandler, notFoundHandler } from './middleware/error-handler';
import { ensureLocalSandboxRegistered, startLocalSandboxSelfHeal } from './startup/local-sandbox';
import { getCacheMetrics } from './middleware/tenant-config-loader';
import { createDb, withTenantContext } from '@aether/db';
import { createTenantRlsMiddleware } from './middleware/tenant-rls';

// ─── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono();

// Non-blocking Redis — server starts even if Redis is slow/unavailable.
// Routes that need Redis will gracefully fail until it connects.
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

// === Top-Level Health Check (no auth) ===

// API version is injected at container start by deploy-zero-downtime.sh,
// which extracts it from the Docker image tag (e.g. aether/aether-api:0.8.29 → 0.8.29).
// Falls back to 'dev' for local development.
const API_VERSION = process.env.SANDBOX_VERSION || 'dev';

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aether-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    env: config.ENV_MODE,
    tunnel: getTunnelServiceStatus(),
    cache: getCacheMetrics(),
  });
});

// Health check under /v1 prefix (frontend uses NEXT_PUBLIC_BACKEND_URL which includes /v1)
app.get('/v1/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aether-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    env: config.ENV_MODE,
    tunnel: getTunnelServiceStatus(),
    cache: getCacheMetrics(),
  });
});

// Also expose system status at root for backward compat with frontend
app.get('/v1/system/status', (c) => {
  return c.json({
    maintenanceNotice: { enabled: false },
    technicalIssue: { enabled: false },
    updatedAt: new Date().toISOString(),
  });
});

// ─── Stub Endpoints ─────────────────────────────────────────────────────────
// These endpoints are called by the frontend but were never implemented.
// Adding proper stubs stops 404 noise and provides correct responses.

// POST /v1/prewarm — no-op pre-warm. Frontend fires this on login.
app.post('/v1/prewarm', (c) => {
  return c.json({ success: true });
});

// GET /v1/accounts — returns user's accounts.
// Dual-read: aether.account_members first, falls back to basejump.account_user.
app.get('/v1/accounts', supabaseAuth, async (c: any) => {
  const userId = c.get('userId') as string;
  const userEmail = c.get('userEmail') as string;

  const { eq } = await import('drizzle-orm');
  const { accountMembers, accounts, accountUser } = await import('@aether/db');
  const { db } = await import('./shared/db');

  // 1. Try aether.account_members (new table)
  try {
    const memberships = await db
      .select({
        accountId: accountMembers.accountId,
        accountRole: accountMembers.accountRole,
        name: accounts.name,
        personalAccount: accounts.personalAccount,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accountMembers)
      .innerJoin(accounts, eq(accountMembers.accountId, accounts.accountId))
      .where(eq(accountMembers.userId, userId));

    if (memberships.length > 0) {
      return c.json(memberships.map(m => ({
        account_id: m.accountId,
        name: m.name || userEmail || 'User',
        slug: m.accountId.slice(0, 8),
        personal_account: m.personalAccount,
        created_at: m.createdAt?.toISOString() ?? new Date().toISOString(),
        updated_at: m.updatedAt?.toISOString() ?? new Date().toISOString(),
        account_role: m.accountRole || 'owner',
        is_primary_owner: m.accountRole === 'owner',
      })));
    }
  } catch (err) {
    appLogger.warn('[accounts] aether.account_members query failed, falling back to basejump', { error: String(err) });
  }

  // 2. Fall back to basejump.account_user (legacy, cloud prod)
  try {
    const legacyMemberships = await db
      .select({
        accountId: accountUser.accountId,
        accountRole: accountUser.accountRole,
      })
      .from(accountUser)
      .where(eq(accountUser.userId, userId));

    if (legacyMemberships.length > 0) {
      return c.json(legacyMemberships.map(m => ({
        account_id: m.accountId,
        name: userEmail || 'User',
        slug: m.accountId.slice(0, 8),
        personal_account: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        account_role: m.accountRole || 'owner',
        is_primary_owner: m.accountRole === 'owner',
      })));
    }
  } catch (err) {
    appLogger.warn('[accounts] basejump.account_user query failed, returning synthetic account', { error: String(err) });
  }

  // 3. No memberships anywhere — return userId as personal account
  return c.json([
    {
      account_id: userId,
      name: userEmail || 'User',
      slug: userId.slice(0, 8),
      personal_account: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      account_role: 'owner',
      is_primary_owner: true,
    },
  ]);
});


app.get('/v1/user-roles', supabaseAuth, async (c: any) => {
  const { getPlatformRole } = await import('./shared/platform-roles');

  const accountId = c.get('userId') as string;
  const role = await getPlatformRole(accountId);
  const isAdmin = role === 'admin' || role === 'super_admin';

  return c.json({ isAdmin, role });
});

// ─── Mount Sub-Services ─────────────────────────────────────────────────────
// All services follow the pattern: /v1/{serviceName}/...

app.route('/v1/router', router);        // /v1/router/chat/completions, /v1/router/models, /v1/router/web-search, /v1/router/tavily/*, etc.
app.route('/v1/billing', billingApp);   // /v1/billing/account-state, /v1/billing/webhooks/*, /v1/billing/setup/*
app.route('/v1/platform', platformApp); // /v1/platform/providers, /v1/platform/sandbox/*, /v1/platform/sandbox/version
if (config.AETHER_DEPLOYMENTS_ENABLED) {
  const { deploymentsApp } = await import('./deployments');
  app.route('/v1/deployments', deploymentsApp); // /v1/deployments/*
}
app.route('/v1/pipedream', integrationsApp);

// Access control — public endpoints for signup gating
app.route('/v1/access', accessControlApp); // /v1/access/signup-status, /v1/access/check-email, /v1/access/request-access

// Legacy thread migration — authenticated endpoints
app.route('/v1/legacy', legacyApp); // /v1/legacy/threads, /v1/legacy/threads/:id/migrate

// [channels v2] Old webhook forwarding and channel CRUD removed.
// Channels are now managed inside the sandbox via CLI (kchannel, ktelegram, kslack).
// Webhooks go directly to the sandbox via share URLs.

// Setup — local/self-hosted only. Disabled in cloud mode (not needed, exposes admin surface).
if (config.isLocal()) {
  app.route('/v1/setup', setupApp);        // /v1/setup/install-status (public), rest (auth inside router)
}
app.route('/v1/admin', adminApp);          // /v1/admin/api/sandboxes, /v1/admin/api/env, /v1/admin/api/health, etc.
app.route('/v1/admin/sandbox-pool', sandboxPoolAdminApp); // /v1/admin/sandbox-pool/health, /v1/admin/sandbox-pool/list, etc.

// OAuth2 provider — public token endpoint, auth on authorize/consent
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

app.route('/v1/verticals', verticalsApp); // /v1/verticals/finance/*, /v1/verticals/insurance/*, /v1/verticals/advisor/*

// All remaining routes require authentication (JWT or aether_ token).
app.use('/v1/providers/*', combinedAuth);
app.route('/v1/providers', providersApp);   // /v1/providers, /v1/providers/schema, /v1/providers/:id/connect, /v1/providers/:id/disconnect, /v1/providers/health

app.use('/v1/secrets/*', combinedAuth);
app.route('/v1/secrets', secretsApp);       // /v1/secrets, /v1/secrets/:key (PUT/DELETE)

app.use('/v1/servers/*', combinedAuth);
app.route('/v1/servers', serversApp);        // /v1/servers, /v1/servers/:id, /v1/servers/sync

app.use('/v1/queue/*', combinedAuth);
app.route('/v1/queue', queueApp);            // /v1/queue/sessions/:id, /v1/queue/messages/:id, /v1/queue/all, /v1/queue/status

// Public device-auth endpoints (no auth — CLI uses these)
import { createDeviceAuthPublicRouter } from './tunnel/routes/device-auth';
app.route('/v1/tunnel/device-auth', createDeviceAuthPublicRouter());

app.use('/v1/tunnel/*', async (c, next) => {
  // Skip auth for public device-auth routes: POST /device-auth and GET /device-auth/:code/status
  const path = c.req.path.replace('/v1/tunnel/device-auth', '');
  if (c.req.path.startsWith('/v1/tunnel/device-auth')) {
    if (c.req.method === 'POST' && (path === '' || path === '/')) return next();
    if (c.req.method === 'GET' && path.endsWith('/status')) return next();
  }
  return combinedAuth(c, next);
});
app.route('/v1/tunnel', tunnelApp);

// WoA moved to /v1/router/woa — see router/index.ts

// ── Aether API — proxies /v1/aether/* to the sandbox's /aether/* ────────────
// Direct server-to-server proxy. Avoids double-CORS from the /v1/p/ path.
// Auth: Supabase JWT (global middleware). Sandbox auth: INTERNAL_SERVICE_KEY.
import { aetherProxyHandler } from './routes/aether-projects';
app.use('/v1/aether/*', combinedAuth);
app.use('/v1/aether', combinedAuth);
app.all('/v1/aether/*', aetherProxyHandler);
app.all('/v1/aether', aetherProxyHandler);

// Sandbox control endpoints — auth cookie issuance and share link management.
// Proxy routes removed: clients now connect to sandboxes directly.
app.route('/v1/p', sandboxProxyApp);

// === Error Handling ===

app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// ─── Auto-register local Docker sandbox in DB ──────────────────────────────
// (Extracted to startup/sandbox-token.ts and startup/local-sandbox.ts)

// === Start Server ===

console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  Aether API Starting                      ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${config.PORT.toString().padEnd(49)}║
║  Mode: ${config.ENV_MODE.padEnd(49)}║
║  Env:  ${config.INTERNAL_AETHER_ENV.padEnd(49)}║
╠═══════════════════════════════════════════════════════════╣
║  Services:                                                ║
║    /v1/router     (search, finance)                     ║
║    /v1/billing    (subscriptions, credits, webhooks)       ║
║    /v1/platform   (sandbox lifecycle)                      ║
${config.AETHER_DEPLOYMENTS_ENABLED ? '║    /v1/deployments (deploy lifecycle)                      ║\n' : ''}║    /v1/pipedream   (Pipedream OAuth integrations)           ║
║    /v1/setup      (setup & env management)                 ║
║    /v1/queue      (persistent message queue)               ║
║    /v1/tunnel     (reverse-tunnel to local machines)         ║
║    /v1/p         (sandbox auth + share)                     ║
╠═══════════════════════════════════════════════════════════╣
║  Database:   ${config.DATABASE_URL ? '✓ Configured'.padEnd(42) : '✗ NOT SET'.padEnd(42)}║
║  Supabase:   ${config.SUPABASE_URL ? '✓ Configured'.padEnd(42) : '✗ NOT SET'.padEnd(42)}║
║  Stripe:     ${config.STRIPE_SECRET_KEY ? '✓ Configured'.padEnd(42) : '✗ NOT SET'.padEnd(42)}║
║  Billing:    ${(config.AETHER_BILLING_INTERNAL_ENABLED ? 'ENABLED' : 'DISABLED').padEnd(42)}║
║  Tunnel:     ${(config.TUNNEL_ENABLED ? 'ENABLED' : 'DISABLED').padEnd(42)}║
║  Providers:  ${config.ALLOWED_SANDBOX_PROVIDERS.join(', ').padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
`);

// Load LLM pricing from models.dev (non-blocking if it fails).
// Awaited so pricing is available before the first billing request.
initModelPricing().catch((err) =>
  console.error('[startup] Model pricing init failed (will retry in 24h):', err),
);

// Schema readiness gate — blocks DB-dependent requests until push completes.
let schemaReady = false;
export function isSchemaReady() { return schemaReady; }

// Ensure DB schema exists before starting services that depend on it.
// This is idempotent — safe to run on every startup.

function startServices() {
  startAccessControlCache();
  startDrainer();
  startTunnelService();
  startAutoReplenish();

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

ensureSchema()
  .then(() => {
    schemaReady = true;
    startServices();
  })
  .catch((err) => {
    appLogger.error('[startup] ensureSchema failed, starting services anyway', err);
    schemaReady = true;
    startServices();
  });

// Graceful shutdown
async function shutdown(signal: string) {
  appLogger.info(`Shutting down gracefully`, { signal });
  stopDrainer();
  stopModelPricing();
  stopTunnelService();
  stopSandboxHealthMonitor();
  stopProvisionPoller();
  stopAutoReplenish();
  stopAccessControlCache();
  // Flush observability data before exit
  await Promise.allSettled([appLogger.flush(), flushSentry()]);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default {
  port: config.PORT,

  async fetch(req: Request, server: any): Promise<Response | undefined> {
    const url = new URL(req.url);
    const isWsUpgrade = req.headers.get('upgrade')?.toLowerCase() === 'websocket';

    // ── Tunnel Agent WebSocket ──────────────────────────────────────────
    // Agent connects, then authenticates via first message (auth handshake).
    // Token is never sent in URL — only tunnelId is in the query string.
    if (isWsUpgrade && url.pathname === '/v1/tunnel/ws') {
      if (!schemaReady) {
        return new Response(JSON.stringify({ error: 'Service starting up, try again shortly' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
        });
      }

      const tunnelId = url.searchParams.get('tunnelId');

      if (!tunnelId) {
        return new Response(JSON.stringify({ error: 'Missing tunnelId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Rate limit WS connections (keyed by tunnelId to prevent connection spam)
      const { tunnelRateLimiter } = await import('./tunnel/core/rate-limiter');
      const wsRateCheck = tunnelRateLimiter.check('wsConnect', tunnelId);
      if (!wsRateCheck.allowed) {
        return new Response(JSON.stringify({
          error: 'Too many connection attempts',
          retryAfterMs: wsRateCheck.retryAfterMs,
        }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const success = server.upgrade(req, {
        data: {
          type: 'tunnel-agent',
          tunnelId,
        },
      });
      if (success) return undefined;
    }

    return app.fetch(req, server);
  },

  websocket: {
    idleTimeout: 300,

    open(ws: { data: any }) {
      if (ws.data?.type === 'tunnel-agent') {
        tunnelWsHandlers.onOpen(ws.data.tunnelId, ws as any);
      }
    },

    message(ws: { data: any }, message: string | Buffer) {
      if (ws.data?.type === 'tunnel-agent') {
        tunnelWsHandlers.onMessage(ws.data.tunnelId, message);
      }
    },

    close(ws: { data: any }) {
      if (ws.data?.type === 'tunnel-agent') {
        tunnelWsHandlers.onClose(ws.data.tunnelId);
      }
    },
  },
};
 
