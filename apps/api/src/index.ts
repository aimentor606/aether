// ─── Observability (must be first — instruments before other imports) ────────
import './lib/sentry';
import { flushSentry } from './lib/sentry';
import { logger as appLogger } from './lib/logger';

import { Hono } from 'hono';
import { config } from './config';

// ─── Sub-Service Imports ──────────────────────────────────────────────────── 

import { router } from './router';
import { billingApp } from './billing';
import { platformApp } from './platform';
import { sandboxProxyApp, resolveProvider } from './sandbox-proxy';
import { proxyToSandbox } from './sandbox-proxy/routes/local-preview';
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
import { parsePreviewSubdomain, extractCookieToken, validatePreviewToken, isSubdomainAuthenticated, markSubdomainAuthenticated } from './startup/subdomain-preview';
import { WsProxyData, WS_CONNECT_TIMEOUT_MS, WS_BUFFER_MAX_BYTES, clearWsTimers, resetIdleTimer, resolveWsTarget } from './startup/ws-proxy-helpers';
import { getCacheMetrics } from './middleware/tenant-config-loader';

// ─── App Setup ──────────────────────────────────────────────────────────────

const app = new Hono();

// === Global Middleware ===

app.use('*', corsMiddleware);
app.use('*', requestContextMiddleware);
app.use('*', requestLoggerMiddleware);
app.use('*', observabilityMiddleware);
if (devPrettyJsonMiddleware) app.use('*', devPrettyJsonMiddleware);

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
  } catch {
    // Table doesn't exist yet — continue to basejump fallback
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
  } catch {
    // basejump doesn't exist — continue to fallback
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

// Verticals — multi-tenant vertical-specific routes (require auth + tenant context + rate limit)
app.use('/v1/verticals/*', combinedAuth);
app.use('/v1/verticals/*', tenantConfigLoader);
app.use('/v1/verticals/*', tenantRateLimit({ limit: 100, windowMs: 60_000 }));
app.route('/v1/verticals', verticalsApp); // /v1/verticals/finance/*, /v1/verticals/healthcare/*, /v1/verticals/retail/*

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

// Preview Proxy — unified route for both cloud (Daytona) and local mode.
// Pattern: /v1/p/{sandboxId}/{port}/* for ALL modes.
// Cloud:  sandboxId = Daytona external ID → proxied via Daytona SDK
// Local:  sandboxId = container name (e.g. 'aether-sandbox') → Docker DNS resolution
// JustAVPS: sandboxId → CF Worker proxy at {port}--{slug}.aether.cloud
// Auth: unified previewProxyAuth (accepts Supabase JWT and aether_ tokens).
// MUST be after all explicit routes (wildcard catch-all).
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
║    /v1/router     (search, LLM, proxy)                    ║
║    /v1/billing    (subscriptions, credits, webhooks)       ║
║    /v1/platform   (sandbox lifecycle)                      ║
${config.AETHER_DEPLOYMENTS_ENABLED ? '║    /v1/deployments (deploy lifecycle)                      ║\n' : ''}║    /v1/pipedream   (Pipedream OAuth integrations)           ║
║    /v1/setup      (setup & env management)                 ║
║    /v1/queue      (persistent message queue)               ║
║    /v1/tunnel     (reverse-tunnel to local machines)         ║
║    /v1/p         (sandbox proxy — local + cloud)            ║
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
ensureSchema()
  .then(async () => {
    schemaReady = true;
    startAccessControlCache();
    startDrainer();
    startTunnelService();
    startAutoReplenish();

    if (config.isLocalDockerEnabled() && config.DATABASE_URL) {
      // Non-blocking: sandbox registration + token sync runs in background.
      // Must NOT await — the /env API call can take seconds and would block
      // all route handlers from being ready. The self-heal timer ensures
      // convergence even if the first attempt fails.
      ensureLocalSandboxRegistered().catch((err) =>
        console.error('[startup] Failed to register local sandbox:', err),
      );
      startLocalSandboxSelfHeal();
      startSandboxHealthMonitor();
    }

    // Start provision poller for cloud mode (compensates for broken/missing webhooks)
    if (config.isJustAVPSEnabled()) {
      startProvisionPoller();
    }
  })
  .catch(async (err) => {
    console.error('[startup] ensureSchema failed, starting services anyway:', err);
    schemaReady = true;
    startAccessControlCache();
    startDrainer();
    startTunnelService();
    startAutoReplenish();

    if (config.isLocalDockerEnabled() && config.DATABASE_URL) {
      ensureLocalSandboxRegistered().catch((e) =>
        console.error('[startup] Failed to register local sandbox:', e),
      );
      startLocalSandboxSelfHeal();
      startSandboxHealthMonitor();
    }

    if (config.isJustAVPSEnabled()) {
      startProvisionPoller();
    }
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

// ─── WebSocket proxy for sandbox PTY ─────────────────────────────────────────
// Helpers extracted to startup/ws-proxy-helpers.ts and startup/subdomain-preview.ts.

let activeWsConnections = 0;

export default {
  port: config.PORT,

  async fetch(req: Request, server: any): Promise<Response | undefined> {
    const host = req.headers.get('host') || '';
    const url = new URL(req.url);
    const isWsUpgrade = req.headers.get('upgrade')?.toLowerCase() === 'websocket';

    // ── Subdomain preview routing (primary) ────────────────────────────
    // Matches: p{port}-{sandboxId}.localhost:{serverPort}
    // Only for local_docker mode (Daytona has its own preview URLs).
    const subdomain = !config.isDaytonaEnabled() ? parsePreviewSubdomain(host) : null;

    if (subdomain) {
      const { port, sandboxId } = subdomain;

      // ── CORS preflight must be handled BEFORE auth ──────────────────
      // Browsers send OPTIONS without Authorization headers. If we block
      // the preflight with 401, the browser can never send the actual
      // request that carries the Bearer token to authenticate the subdomain.
      if (req.method === 'OPTIONS') {
        const origin = req.headers.get('Origin') || '';
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin || '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': req.headers.get('Access-Control-Request-Headers') || '*',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      // ── Auth: first request validates, then the subdomain is "open" ──
      // Bearer header or cookie on first load proves you're legit,
      // then all subsequent requests (sub-resources, WS, etc.) pass through.
      // This avoids third-party cookie issues in iframes.
      if (!isSubdomainAuthenticated(sandboxId, port)) {
        const authHeader = req.headers.get('Authorization');
        const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const aetherTokenHeader = req.headers.get('X-aether-Token');
        const cookieToken = extractCookieToken(req);
        // Also accept ?token= query param — browser WebSocket API can't set
        // custom headers, and initial page loads may not have cookies yet.
        const queryToken = url.searchParams.get('token');
        const token = bearerToken || cookieToken || aetherTokenHeader || queryToken;

        if (!token || !(await validatePreviewToken(token, sandboxId))) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': req.headers.get('Origin') || '*',
              'Access-Control-Allow-Credentials': 'true',
            },
          });
        }
        // Auth succeeded — mark this subdomain as authenticated
        markSubdomainAuthenticated(sandboxId, port);
      }

      // ── WebSocket upgrade via subdomain ──────────────────────────────
      if (isWsUpgrade) {
        const resolved = await resolveProvider(sandboxId).catch(() => null);
        const provider = resolved?.provider ?? 'local_docker';

        const wsTarget = resolveWsTarget(provider, {
          sandboxId,
          port,
          remainingPath: url.pathname,
          searchParams: url.searchParams,
          slug: resolved?.slug,
          serviceKey: resolved?.serviceKey,
          proxyToken: resolved?.proxyToken,
        });

        const success = server.upgrade(req, {
          data: {
            targetUrl: wsTarget.url,
            upstreamHeaders: wsTarget.headers,
            upstream: null,
            buffered: [],
            bufferBytes: 0,
            connectTimer: null,
            idleTimer: null,
            closed: false,
          } satisfies WsProxyData,
        });
        if (success) return undefined;
      }

      // ── HTTP/SSE via subdomain — direct proxy, no Hono ───────────────
      const origin = req.headers.get('Origin') || '';
      let body: ArrayBuffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        body = await req.arrayBuffer();
      }

      // NOTE: CORS preflight (OPTIONS) is handled above, before the auth check.

      try {
        // JustAVPS: route through CF Worker proxy at {port}--{slug}.{domain}
        if (config.isJustAVPSEnabled()) {
          const { sandboxes } = await import('@aether/db');
          const { db } = await import('./shared/db');
          const { eq, and, ne } = await import('drizzle-orm');
          const [sandbox] = await db
            .select({ provider: sandboxes.provider, config: sandboxes.config, metadata: sandboxes.metadata })
            .from(sandboxes)
            .where(and(eq(sandboxes.externalId, sandboxId), ne(sandboxes.status, 'pooled')))
            .limit(1);

          if (sandbox?.provider === 'justavps') {
            const meta = (sandbox.metadata || {}) as Record<string, unknown>;
            const slug = meta.justavpsSlug as string || '';
            const proxyToken = meta.justavpsProxyToken as string || '';
            const svcKey = (sandbox.config as Record<string, unknown>)?.serviceKey as string || '';
            const proxyDomain = config.JUSTAVPS_PROXY_DOMAIN;
            const cfProxyUrl = `https://${port}--${slug}.${proxyDomain}`;
            const extra: Record<string, string> = {};
            if (proxyToken) {
              extra['X-Proxy-Token'] = proxyToken;
            }
            return await proxyToSandbox(
              sandboxId, 8000, req.method, url.pathname, url.search,
              req.headers, body, false, origin, cfProxyUrl, svcKey, extra,
            );
          }
        }

        return await proxyToSandbox(
          sandboxId, port, req.method, url.pathname, url.search,
          req.headers, body, false, origin,
        );
      } catch (error) {
        console.error(`[subdomain-proxy] Error for ${sandboxId}:${port}${url.pathname}: ${error instanceof Error ? error.message : String(error)}`);
        return new Response(JSON.stringify({ error: 'Failed to proxy to sandbox', details: String(error) }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

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

    // ── Path-based WebSocket proxy ─────────────────────────────────────────
    // Matches: ws://localhost:8008/v1/p/{sandboxId}/{port}/*
    // Used for OpenCode PTY terminals, SSE-over-WS, etc.
    // Must be handled HERE (at Bun server level) because Hono can't do WS upgrades.
    // Each provider resolves the upstream WebSocket URL differently.
    if (isWsUpgrade && !config.isDaytonaEnabled()) {
      const wsPathMatch = url.pathname.match(/^\/v1\/p\/([^/]+)\/(\d+)(\/.*)?$/);
      if (wsPathMatch) {
        const wsSandboxId = wsPathMatch[1];
        const wsPort = parseInt(wsPathMatch[2], 10);
        const wsRemainingPath = wsPathMatch[3] || '/';

        const wsAuthHeader = req.headers.get('Authorization');
        const wsBearerToken = wsAuthHeader?.startsWith('Bearer ') ? wsAuthHeader.slice(7) : null;
        const wsAetherTokenHeader = req.headers.get('X-aether-Token');
        const wsCookieToken = extractCookieToken(req);
        const wsQueryToken = url.searchParams.get('token');
        const wsToken = wsBearerToken || wsCookieToken || wsAetherTokenHeader || wsQueryToken;

        if (wsToken && (await validatePreviewToken(wsToken, wsSandboxId))) {
          const resolved = await resolveProvider(wsSandboxId).catch(() => null);
          const provider = resolved?.provider ?? 'local_docker';

          const wsTarget = resolveWsTarget(provider, {
            sandboxId: wsSandboxId,
            port: wsPort,
            remainingPath: wsRemainingPath,
            searchParams: url.searchParams,
            slug: resolved?.slug,
            serviceKey: resolved?.serviceKey,
            proxyToken: resolved?.proxyToken,
          });

          const success = server.upgrade(req, {
            data: {
              targetUrl: wsTarget.url,
              upstreamHeaders: wsTarget.headers,
              upstream: null,
              buffered: [],
              bufferBytes: 0,
              connectTimer: null,
              idleTimer: null,
              closed: false,
            } satisfies WsProxyData,
          });
          if (success) return undefined;
        }
      }
    }

    return app.fetch(req, server);
  },

  websocket: {
    // Disable Bun's default 120s idle timeout — tunnel agents use their own
    // heartbeat mechanism (30s ping/pong) for liveness detection.
    idleTimeout: 0,

    open(ws: { data: any; send: (data: any) => void; close: (code?: number, reason?: string) => void }) {
      if (ws.data?.type === 'tunnel-agent') {
        tunnelWsHandlers.onOpen(ws.data.tunnelId, ws as any);
        return;
      }

      activeWsConnections++;
      resetIdleTimer(ws);

      ws.data.connectTimer = setTimeout(() => {
        if (ws.data.upstream?.readyState === WebSocket.CONNECTING) {
          console.warn(`[preview-proxy] WS upstream connect timeout`);
          try { ws.data.upstream.close(); } catch {}
          try { ws.close(1011, 'upstream connect timeout'); } catch {}
        }
      }, WS_CONNECT_TIMEOUT_MS);

      try {
        const upstream = new WebSocket(ws.data.targetUrl, { headers: ws.data.upstreamHeaders || {} } as any);
        ws.data.upstream = upstream;

        upstream.addEventListener('open', () => {
          if (ws.data.connectTimer) { clearTimeout(ws.data.connectTimer); ws.data.connectTimer = null; }
          for (const msg of ws.data.buffered) {
            upstream.send(msg);
          }
          ws.data.buffered = [];
          ws.data.bufferBytes = 0;
        });

        upstream.addEventListener('message', (e: MessageEvent) => {
          resetIdleTimer(ws);
          try { ws.send(e.data); } catch {
            try { upstream.close(); } catch {}
          }
        });

        upstream.addEventListener('close', () => {
          if (!ws.data.closed) {
            try { ws.close(); } catch {}
          }
        });

        upstream.addEventListener('error', () => {
          if (!ws.data.closed) {
            try { ws.close(1011, 'upstream error'); } catch {}
          }
        });
      } catch (err) {
        console.error(`[preview-proxy] WS connect failed:`, err);
        try { ws.close(1011, 'upstream connection failed'); } catch {}
      }
    },

    message(ws: { data: any; close: (code?: number, reason?: string) => void }, message: string | Buffer) {
      if (ws.data?.type === 'tunnel-agent') {
        tunnelWsHandlers.onMessage(ws.data.tunnelId, message);
        return;
      }

      resetIdleTimer(ws);
      const upstream = ws.data.upstream;
      if (upstream && upstream.readyState === WebSocket.OPEN) {
        upstream.send(message);
      } else if (upstream && upstream.readyState === WebSocket.CONNECTING) {
        const size = typeof message === 'string' ? message.length : (message as Buffer).byteLength;
        if (ws.data.bufferBytes + size > WS_BUFFER_MAX_BYTES) {
          console.warn(`[preview-proxy] WS buffer overflow, closing`);
          try { ws.close(1011, 'buffer overflow'); } catch {}
          return;
        }
        ws.data.buffered.push(message);
        ws.data.bufferBytes += size;
      }
    },

    close(ws: { data: any }) {
      if (ws.data?.type === 'tunnel-agent') {
        tunnelWsHandlers.onClose(ws.data.tunnelId);
        return;
      }

      activeWsConnections--;
      ws.data.closed = true;
      clearWsTimers(ws.data);
      try { ws.data.upstream?.close(); } catch {}
      ws.data.upstream = null;
      ws.data.buffered = [];
      ws.data.bufferBytes = 0;
    },
  },
};
 
