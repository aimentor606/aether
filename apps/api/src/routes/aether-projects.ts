/**
 * Aether API proxy handler — /v1/aether/*
 *
 * Proxies /v1/aether/* requests to the user's active sandbox.
 * Local mode hits the sandbox directly via Docker DNS or localhost.
 * Cloud mode uses the sandbox's base_url from the DB.
 */

import type { Context } from 'hono';
import { config } from '../config';
import { db } from '../shared/db';
import { resolveAccountIdStrict } from '../shared/resolve-account';

function getSandboxBaseUrl(sandboxId: string): string {
  if (config.SANDBOX_NETWORK) {
    return `http://${sandboxId}:8000`;
  }
  return `http://localhost:${config.SANDBOX_PORT_BASE}`;
}

async function resolveActiveSandbox(userId: string): Promise<{ externalId: string | null; baseUrl: string | null; proxyToken: string | null }> {
  const accountId = await resolveAccountIdStrict(userId);
  const safeAccountId = accountId.replace(/'/g, "''");
  const rows = await db.execute(`
    select external_id, base_url, metadata
    from aether.sandboxes
    where account_id = '${safeAccountId}'
    order by updated_at desc
    limit 1
  `);
  const row = rows?.[0] as { external_id?: string; base_url?: string; metadata?: { justavpsProxyToken?: string } | string | null } | undefined;
  let proxyToken: string | null = null;
  if (row?.metadata && typeof row.metadata === 'object' && 'justavpsProxyToken' in row.metadata) {
    proxyToken = (row.metadata as { justavpsProxyToken?: string }).justavpsProxyToken || null;
  }
  return {
    externalId: row?.external_id ?? null,
    baseUrl: row?.base_url ?? null,
    proxyToken,
  };
}

export async function aetherProxyHandler(c: Context): Promise<Response> {
  // /v1/aether/projects/xxx → /aether/projects/xxx (sandbox still uses /aether/ routes)
  const sandboxPath = c.req.path.replace(/^\/v1/, '').replace(/\/+$/, '') || '/aether';

  // Local/self-hosted can hit the local sandbox directly.
  if (!config.JUSTAVPS_API_KEY) {
    const targetUrl = `${getSandboxBaseUrl(config.SANDBOX_CONTAINER_NAME)}${sandboxPath}`;
    const headers = new Headers();
    const ct = c.req.header('content-type');
    if (ct) headers.set('Content-Type', ct);
    if (config.INTERNAL_SERVICE_KEY) headers.set('Authorization', `Bearer ${config.INTERNAL_SERVICE_KEY}`);

    try {
      const res = await fetch(targetUrl, {
        method: c.req.method,
        headers,
        body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.arrayBuffer();
      return new Response(data, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
      });
    } catch (err: any) {
      return c.json({ error: 'Sandbox unreachable', detail: err?.message }, 502);
    }
  }

  // Cloud/JustAVPS: resolve the sandbox's base_url and proxy directly.
  const userId = c.get('userId') as string;
  const { externalId, baseUrl, proxyToken } = await resolveActiveSandbox(userId);
  if (!externalId) {
    return c.json({ error: 'No active sandbox found for account' }, 404);
  }

  if (!baseUrl) {
    return c.json({ error: 'Sandbox has no reachable URL', external_id: externalId }, 502);
  }

  const targetUrl = `${baseUrl}${sandboxPath}${new URL(c.req.url).search}`;
  const headers = new Headers();
  const ct = c.req.header('content-type');
  if (ct) headers.set('Content-Type', ct);
  if (proxyToken) headers.set('X-Proxy-Token', proxyToken);
  try {
    const res = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? await c.req.arrayBuffer() : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.arrayBuffer();
    return new Response(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (err: any) {
    return c.json({ error: 'Sandbox unreachable', detail: err?.message }, 502);
  }
}
