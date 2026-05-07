import { Hono } from 'hono';
import { eq, and, ne } from 'drizzle-orm';
import { sandboxes } from '@aether/db';
import { config } from '../config';
import { combinedAuth } from '../middleware/auth';
import { getAuthToken } from './routes/auth';
import { shareApp } from './routes/share';
import { proxyToSandbox } from './routes/local-preview';
import { db } from '../shared/db';

const sandboxProxyApp = new Hono();

// ── Cookie auth endpoint ────────────────────────────────────────────────────
// POST /v1/p/auth — validates JWT and sets __preview_session cookie.
sandboxProxyApp.route('/auth', getAuthToken);

// ── Public URL share endpoint ───────────────────────────────────────────────
// POST /v1/p/share — returns a shareable URL for a sandbox port.
sandboxProxyApp.route('/share', shareApp);

// ── Catch-all proxy to sandbox ──────────────────────────────────────────────
// /v1/p/{sandboxId}/{port}/* → forwards to sandbox's aether-master (port 8000)
// or sandbox's port proxy for other ports.
sandboxProxyApp.use('/:sandboxId/:port/*', combinedAuth);
sandboxProxyApp.use('/:sandboxId/:port', combinedAuth);

sandboxProxyApp.all('/:sandboxId/:port/*', async (c) => {
  const sandboxId = c.req.param('sandboxId');
  const port = parseInt(c.req.param('port'), 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    return c.json({ error: `Invalid port: ${c.req.param('port')}` }, 400);
  }

  const fullPath = new URL(c.req.url).pathname;
  const prefix = `/${sandboxId}/${port}`;
  const idx = fullPath.indexOf(prefix);
  const remainingPath = idx !== -1 ? fullPath.slice(idx + prefix.length) || '/' : '/';
  const queryString = new URL(c.req.url).search;

  const method = c.req.method;
  let body: ArrayBuffer | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    body = await c.req.raw.arrayBuffer();
  }

  const origin = c.req.header('Origin') || '';

  return proxyToSandbox(sandboxId, port, method, remainingPath, queryString, c.req.raw.headers, body, false, origin);
});

sandboxProxyApp.all('/:sandboxId/:port', async (c) => {
  const sandboxId = c.req.param('sandboxId');
  const port = c.req.param('port');
  return c.redirect(`/${sandboxId}/${port}/`, 301);
});

// ── Provider cache ──────────────────────────────────────────────────────────
// Cache sandbox provider lookups to avoid a DB query on every request.
// Key: externalId, Value: { provider, expiresAt }
type CachedProviderName = 'daytona' | 'local_docker' | 'justavps';
interface ProviderCacheEntry {
  provider: CachedProviderName;
  baseUrl: string;
  serviceKey: string;
  proxyToken: string;
  slug: string;
  expiresAt: number;
}
const providerCache = new Map<string, ProviderCacheEntry>();
const PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function resolveProvider(externalId: string): Promise<{ provider: CachedProviderName; baseUrl: string; serviceKey: string; proxyToken: string; slug: string } | null> {
  const cached = providerCache.get(externalId);
  if (cached && Date.now() < cached.expiresAt) {
    return { provider: cached.provider, baseUrl: cached.baseUrl, serviceKey: cached.serviceKey, proxyToken: cached.proxyToken, slug: cached.slug };
  }
  providerCache.delete(externalId);

  try {
    const [sandbox] = await db
      .select({ provider: sandboxes.provider, baseUrl: sandboxes.baseUrl, config: sandboxes.config, metadata: sandboxes.metadata })
      .from(sandboxes)
      .where(
        and(
          eq(sandboxes.externalId, externalId),
          ne(sandboxes.status, 'pooled'),
        )
      )
      .limit(1);

    if (!sandbox) return null;

    const provider = sandbox.provider as CachedProviderName;
    const baseUrl = sandbox.baseUrl || '';
    const configJson = (sandbox.config || {}) as Record<string, unknown>;
    const serviceKey = typeof configJson.serviceKey === 'string' ? configJson.serviceKey : '';
    const metaJson = (sandbox.metadata || {}) as Record<string, unknown>;
    let proxyToken = typeof metaJson.justavpsProxyToken === 'string' ? metaJson.justavpsProxyToken : '';
    const slug = typeof metaJson.justavpsSlug === 'string' ? metaJson.justavpsSlug : '';

    if (provider === 'justavps' && !proxyToken && config.JUSTAVPS_API_KEY) {
      try {
        const apiBase = config.JUSTAVPS_API_URL.replace(/\/$/, '');
        const res = await fetch(`${apiBase}/proxy-tokens`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.JUSTAVPS_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            machine_id: externalId,
            label: `aether-sandbox-${externalId}`,
            expires_in_seconds: 7 * 24 * 60 * 60,
          }),
        });
        if (res.ok) {
          const data = await res.json() as { token: string };
          proxyToken = data.token;
          await db.update(sandboxes).set({
            metadata: { ...metaJson, justavpsProxyToken: proxyToken },
            updatedAt: new Date(),
          }).where(eq(sandboxes.externalId, externalId));
          console.log(`[PREVIEW] Lazy-created proxy token for JustAVPS sandbox ${externalId}`);
        } else {
          const errText = await res.text().catch(() => '');
          console.error(`[PREVIEW] Proxy token creation returned ${res.status}: ${errText.slice(0, 300)}`);
        }
      } catch (err) {
        console.warn(`[PREVIEW] Failed to lazy-create proxy token for ${externalId}:`, err);
      }
    }

    // Don't cache JustAVPS entries without a proxy token — retry on next request
    const cacheTtl = (provider === 'justavps' && !proxyToken) ? 0 : PROVIDER_CACHE_TTL_MS;
    providerCache.set(externalId, { provider, baseUrl, serviceKey, proxyToken, slug, expiresAt: Date.now() + cacheTtl });
    return { provider, baseUrl, serviceKey, proxyToken, slug };
  } catch (err) {
    console.error(`[PREVIEW] Provider lookup failed for ${externalId}:`, err);
    return null;
  }
}

export { sandboxProxyApp };
