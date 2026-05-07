import { timingSafeEqual, createHash } from 'crypto'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { describeRoute, resolver, generateSpecs } from 'hono-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { buildMergedSpec } from './services/spec-merger'
import { proxyToOpenCode } from './services/proxy'
import { boot } from './boot'
import { createWsServer, getActiveConnections } from './ws-proxy'
// REMOVED: opencode-hotreload watcher — it auto-disposed the OpenCode instance on
// ANY .opencode/ file change, killing all active agent sessions mid-operation.
// Dispose is now handled explicitly by:
//   1. Marketplace installs (frontend calls client.instance.dispose() after ocx add)
//   2. Skill CRUD (skills-api.ts calls client.instance.dispose() after mutations)
//   3. Agent tool (instance_dispose tool for manual config reload)
import envRouter from './routes/env'
import lssRouter from './routes/lss'
import proxyRouter from './routes/proxy'
import webProxyRouter from './routes/web-proxy'
import { updateRoutes as updateRouter } from './routes/update'
import deployRouter from './routes/deploy'
import servicesRouter from './routes/services'
import pipedreamRouter, { pushPipedreamCredsToApi } from './routes/pipedream'
import connectorsRouter from './routes/connectors'
import suggestionsRouter from './routes/suggestions'
import coreRouter from './routes/core'
import reloadRouter from './routes/reload'
import triggersRouter from './routes/triggers'
import shareRouter from './routes/share'
import shareProxyRouter from './routes/share-proxy'
import marketplaceRouter from './routes/marketplace'
import preferencesRouter from './routes/preferences'
import projectsRouter from './routes/projects'
import { tasksRouter } from './routes/tasks'
import { agentsRouter } from './routes/agents'
import { config } from './config'
import { HealthResponse, PortsResponse } from './schemas/common'

const { secretStore } = await boot()
const app = new Hono()

// Cron scheduling + webhook routing handled by unified triggers plugin.
// TriggerManager starts cron jobs from .kortix/triggers.yaml + DB on boot.

// Global middleware
app.use('*', logger())

// CORS: restrict to allowed origins. Defaults to localhost-only for security.
// CORS_ALLOWED_ORIGINS can add extra origins (comma-separated).
const defaultCorsOrigins = [
  'http://localhost:3000', 'http://127.0.0.1:3000',   // Frontend (local)
  'http://localhost:8008', 'http://127.0.0.1:8008',   //api (local)
  'http://localhost:14000', 'http://127.0.0.1:14000', // Direct sandbox (dev)
]
const extraCorsOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean)
  : []
const corsOrigins = [...new Set([...defaultCorsOrigins, ...extraCorsOrigins])]
app.use('*', cors({ origin: corsOrigins }))

// ─── Timing-safe token comparison ─────────────────────────────────────────────
// Hash both values so timingSafeEqual always compares equal-length buffers,
// regardless of token length. Prevents timing side-channel attacks.
function verifyServiceKey(candidate: string): boolean {
  const expected = config.INTERNAL_SERVICE_KEY
  if (!candidate || !expected) return false
  const a = createHash('sha256').update(candidate).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// ─── Localhost detection ─────────────────────────────────────────────────────
// Requests originating from inside the container (localhost/loopback) skip auth.
// This allows tools, scripts, and curl inside the sandbox to call the master
// without needing INTERNAL_SERVICE_KEY. External callers (kortix-api, frontend
// proxy) still must provide the key.
const LOOPBACK_ADDRS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'])

function isLocalRequest(c: any): boolean {
  const addr = c.env?.remoteAddr
  return !!addr && LOOPBACK_ADDRS.has(addr)
}

// ─── Global auth ─────────────────────────────────────────────────────────────
// Protects ALL routes with bearer token or ?token= query param.
// INTERNAL_SERVICE_KEY is always present (auto-generated if not provided).
// Localhost requests (from inside the sandbox) bypass auth entirely.
app.use('*', async (c, next) => {
  // Skip health endpoint — Docker health probes need unauthenticated access
  const pathname = new URL(c.req.url).pathname
  if (pathname === '/kortix/health') return next()
  // Skip docs endpoints — API docs should be accessible without auth
  if (pathname === '/docs' || pathname === '/docs/openapi.json') return next()
  // [channels v2] Channel webhooks now use /hooks/telegram/<id> and /hooks/slack/<id>
  // which are already covered by the /hooks/* bypass below.
  // Skip auth for Pipedream event delivery — Pipedream POSTs events to
  // /events/pipedream/:listenerId. The listener ID acts as a secret token
  // (UUID, not guessable). Events are forwarded to the triggers webhook server.
  if (pathname.startsWith('/events/pipedream/')) return next()
  // Skip auth for user-defined webhook triggers at /hooks/* — external callers
  // authenticate via the X-Aether-Trigger-Secret header (per-trigger secret).
  if (pathname.startsWith('/hooks/')) return next()
  // Skip auth for share proxy at /s/{token}/* — the share token IS the auth.
  // Token validity + TTL is checked by the share-proxy route handler.
  if (pathname.startsWith('/s/')) return next()

  // Skip auth for requests from inside the sandbox (localhost/loopback)
  if (isLocalRequest(c)) return next()

  const authHeader = c.req.header('Authorization')
  let token: string | null = null

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7)
  }

  if (!token) {
    token = c.req.query('token') || null
  }

  if (!token || !verifyServiceKey(token)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  return next()
})

// ─── Runtime readiness tracking ──────────────────────────────────────────────
let openCodeReady = false
let openCodeLastCheck = 0
const OPENCODE_CHECK_INTERVAL = 5_000 // recheck every 5s when not ready

async function checkOpenCodeReady(): Promise<boolean> {
  if (openCodeReady) return true
  const now = Date.now()
  if (now - openCodeLastCheck < OPENCODE_CHECK_INTERVAL) return false
  openCodeLastCheck = now
  try {
    const res = await fetch(`http://${config.OPENCODE_HOST}:${config.OPENCODE_PORT}/session`, {
      signal: AbortSignal.timeout(3_000),
    })
    if (res.ok) {
      openCodeReady = true
      console.log('[Aether] OpenCode is ready')
      // Consume body to free connection
      await res.arrayBuffer()
      return true
    }
  } catch {}
  return false
}

// Fire initial check in background
checkOpenCodeReady()

// ─── API Documentation ──────────────────────────────────────────────────────

// OpenAPI JSON spec endpoint — merges master + OpenCode specs at runtime
app.get('/docs/openapi.json',
  describeRoute({ hide: true, responses: { 200: { description: 'OpenAPI spec' } } }),
  async (c) => {
    // Generate master's own spec
    constSpec = await generateSpecs(app)
    // Merge with OpenCode's spec (fetched from localhost, cached 30s)
    const merged = await buildMergedSpec(kortixSpec as any)

    // Use the X-Forwarded-Prefix header injected by the platform proxy to set
    // the correct server URL for Scalar "Try It". This header contains the full
    // public base URL (e.g. "http://localhost:8008/v1/p/aether-sandbox/8000").
    // Without it, fall back to the placeholder from spec-merger.
    const forwardedPrefix = c.req.header('x-forwarded-prefix')
    if (forwardedPrefix) {
      return c.json({
        ...merged,
        servers: [{ url: forwardedPrefix, description: 'Current sandbox' }],
      })
    }

    return c.json(merged)
  },
)

// Scalar API Reference UI
app.get('/docs',
  describeRoute({ hide: true, responses: { 200: { description: 'API docs UI' } } }),
  Scalar({
    url: 'docs/openapi.json',
    pageTitle: 'Kortix Sandbox API',
  }),
)

// Health check — includes current sandbox version
// Returns 200 when the agent runtime is reachable, 503 when it's still starting up.
// This ensures Docker/orchestrators treat the container as unhealthy until
// the core API backend (OpenCode) is ready to serve requests.
app.get('/kortix/health',
  describeRoute({
    tags: ['System'],
    summary: 'Health check',
    description: 'Returns sandbox health status, current version, active WebSocket connections, and runtime readiness. Returns 200 when the runtime is reachable, 503 when still starting.',
    responses: {
      200: { description: 'Healthy — runtime is reachable', content: { 'application/json': { schema: resolver(HealthResponse) } } },
      503: { description: 'Starting — runtime is not yet reachable', content: { 'application/json': { schema: resolver(HealthResponse) } } },
    },
  }),
  async (c) => {
    // Version priority: injected SANDBOX_VERSION env var (set at provision from
    // image tag), then baked-in /ephemeral/metadata/.version, then 'unknown'.
    let version = process.env.SANDBOX_VERSION || ''
    if (!version) {
      try {
        const file = Bun.file('/ephemeral/metadata/.version')
        if (await file.exists()) {
          const data = await file.json()
          version = data.version || 'unknown'
        }
      } catch {}
    }
    if (!version) version = 'unknown'
    await checkOpenCodeReady()
    const status = openCodeReady ? 'ok' : 'starting'
    const httpStatus = openCodeReady ? 200 : 503
    return c.json({ status, version, imageVersion: version, activeWs: getActiveConnections(), runtimeReady: openCodeReady }, httpStatus)
  },
)

// Port mappings — returns container→host port map so the frontend
// can use direct URLs instead of guessing proxy paths.
app.get('/kortix/ports',
  describeRoute({
    tags: ['System'],
    summary: 'Port mappings',
    description: 'Returns the container-port to host-port mapping configured by docker-compose. Used by the frontend to build direct URLs.',
    responses: {
      200: { description: 'Port map', content: { 'application/json': { schema: resolver(PortsResponse) } } },
    },
  }),
  (c) => {
    return c.json({ ports: config.PORT_MAP })
  },
)

// Update check — /kortix/update and /kortix/update/status
app.route('/kortix/update', updateRouter)

// ENV management routes
app.route('/env', envRouter)

// LSS semantic search — /lss/search?q=<query> runs local semantic search
app.route('/lss', lssRouter)

// Dashboard and prompt suggestions
app.route('/sessions', suggestionsRouter)

// Deployment management (feature-flagged)
if (config.AETHER_DEPLOYMENTS_ENABLED) {
  app.route('/kortix/deploy', deployRouter)
}

// Services — unified "what's running" for the frontend
app.route('/kortix/services', servicesRouter)

// Triggers — unified CRUD for all trigger types (cron, webhook, etc.)
app.route('/kortix/triggers', triggersRouter)
// Legacy compat: /kortix/cron/* → forwards to /kortix/triggers/*
app.route('/kortix/cron', triggersRouter)

// Channels — SQLite-backed channel management (Telegram, Slack)
import { channelsRouter } from './routes/channels'
app.route('/kortix/channels', channelsRouter)

// Core supervisor management
app.route('/kortix/core', coreRouter)

// Full reload — restarts OpenCode instance and optionally all services
app.route('/kortix/reload', reloadRouter)

// Marketplace — skill/component install from registry
app.route('/kortix/marketplace', marketplaceRouter)

// Preferences — default model management
app.route('/kortix/preferences', preferencesRouter)

// Projects + Tasks — project management (frontend source of truth)
// Mount at both paths — Hono sub-routers don't match trailing slash from parent
app.route('/kortix/projects', projectsRouter)
app.route('/kortix/projects/', projectsRouter)
app.route('/kortix/tasks', tasksRouter)
app.route('/kortix/tasks/', tasksRouter)
app.route('/kortix/agents', agentsRouter)
app.route('/kortix/agents/', agentsRouter)

// Public URL sharing — /kortix/share/:port returns the public URL for a sandbox port
app.route('/kortix/share', shareRouter)

// Connectors — SQLite-backed CRUD
app.route('/kortix/connectors', connectorsRouter)

// Pipedream integration proxy — forwards toapi
app.route('/api/pipedream', pipedreamRouter)

// [channels v2] Channel webhooks — handles /hooks/telegram/<id> and /hooks/slack/<id>
// directly in master. These are looked up in the channels SQLite DB,
// verified, parsed, and dispatched to OpenCode sessions.
// Must be mounted BEFORE the generic /hooks/* proxy to port 8099.
import channelWebhooksRouter from './routes/channel-webhooks'
app.route('', channelWebhooksRouter)

// Webhook trigger proxy — forwards remaining /hooks/* to the triggers webhook server (port 8099).
// Auth is skipped (see auth middleware) — per-trigger secret via X-Aether-Trigger-Secret header.
app.all('/hooks/*', async (c) => {
  const pathname = new URL(c.req.url).pathname
  try {
    const body = ['GET', 'HEAD'].includes(c.req.method) ? undefined : await c.req.text()
    const headers: Record<string, string> = {
      'Content-Type': c.req.header('content-type') || 'application/json',
    }
    // Forward the trigger secret header
    const secret = c.req.header('x-aether-trigger-secret') ?? c.req.header('x-aether-opencode-trigger-secret')
    if (secret) headers['x-aether-trigger-secret'] = secret

    const res = await fetch(`http://localhost:8099${pathname}`, {
      method: c.req.method,
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json()
    return c.json(data, res.status as any)
  } catch (err) {
    console.error(`[Aether] Webhook proxy error for ${pathname}:`, err)
    return c.json({ ok: false, error: 'Failed to forward webhook to trigger server' }, 502)
  }
})

// Pipedream event receiver — forwards events from Pipedream to the
// triggers webhook server (port 8099). Auth is skipped for this
// path (see auth middleware above) — the listener ID (UUID) is the secret.
app.post('/events/pipedream/:listenerId', async (c) => {
  const listenerId = c.req.param('listenerId')
  try {
    const body = await c.req.text()
    const res = await fetch(`http://localhost:8099/events/pipedream/${listenerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': c.req.header('content-type') || 'application/json',
        // Forward Pipedream headers that might be useful for verification
        ...(c.req.header('x-pd-delivery-id') ? { 'x-pd-delivery-id': c.req.header('x-pd-delivery-id')! } : {}),
        ...(c.req.header('x-pd-signature') ? { 'x-pd-signature': c.req.header('x-pd-signature')! } : {}),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json()
    return c.json(data, res.status as any)
  } catch (err) {
    console.error(`[Aether] Pipedream event forward error for ${listenerId}:`, err)
    return c.json({ ok: false, error: 'Failed to forward event to triggers webhook server' }, 502)
  }
})

// Share proxy — /s/:token/* validates share token + TTL, then proxies to the target port.
// Public route (no auth) — the share token IS the authentication.
app.route('/s', shareProxyRouter)

// Dynamic port proxy — /proxy/:port/* forwards to localhost:{port} inside the sandbox
app.route('/proxy', proxyRouter)

// Web forward proxy — /web-proxy/{scheme}/{host}/{path} fetches any URL from inside the sandbox
app.route('/web-proxy', webProxyRouter)

// File management — direct sandbox filesystem access for downloads, uploads, etc.
// Mounted BEFORE the catch-all OpenCode proxy so it works regardless of OpenCode version.
import filesRouter from './routes/files'
app.route('/file', filesRouter)

// Legacy migration — write old thread data into the OpenCode SQLite database
import legacyMigrateRouter from './routes/legacy-migrate'
app.route('/legacy', legacyMigrateRouter)

// [channels v2] The old channels proxy to port 3456 has been removed.
// Channel CLIs (telegram.ts, slack.ts) are standalone scripts.
// Channel webhooks are handled directly by channel-webhooks.ts (mounted above /hooks/* proxy).

// Proxy all other requests to OpenCode
app.all('*',
  describeRoute({ hide: true, responses: { 200: { description: 'Proxied to OpenCode' } } }),
  async (c) => {
    return proxyToOpenCode(c)
  },
)

console.log(`[Aether] Starting on port ${config.PORT}`)

// Push Pipedream creds to API after boot (async, non-blocking)
setTimeout(() => pushPipedreamCredsToApi(), 5_000)
console.log(`[Aether] Proxying to OpenCode at ${config.OPENCODE_HOST}:${config.OPENCODE_PORT}`)
console.log(`[Aether] API docs available at http://localhost:${config.PORT}/docs`)

export default createWsServer({
  verifyServiceKey,
  loopbackAddrs: LOOPBACK_ADDRS,
  app,
})
