/**
 * Sandbox Preview Proxy — transparent pipe to Aether Master inside the sandbox.
 *
 * TRUE TRANSPARENT PROXY:
 *   - decompress: false — raw bytes pass through untouched
 *   - Response body streamed 1:1 (never buffered)
 *   - SSE / long-lived streams work correctly (connection-timeout only, no body timeout)
 *   - Only touches: Host, Authorization (service key), CORS
 *
 * Called from sandbox-proxy/index.ts for path-based (/v1/p/:id/:port/*) routing.
 * WebSocket upgrades are handled at the Bun server level (see index.ts).
 */

import { config } from '../../config';
import { execSync } from 'child_process';

const AETHER_MASTER_PORT = 8000;
const FETCH_TIMEOUT_MS = 30_000;

// ─── Service Key Sync ────────────────────────────────────────────────────────
// Ensures the running sandbox container has the same INTERNAL_SERVICE_KEY as us.
// Triggered on first 401 from the sandbox (key mismatch after startup).
// Retries up to MAX_SYNC_ATTEMPTS on failure before giving up.
const MAX_SYNC_ATTEMPTS = 3;
let _syncAttempts = 0;
let _serviceKeySynced = false;

function trySyncServiceKey(): boolean {
  if (_serviceKeySynced) return false;
  if (_syncAttempts >= MAX_SYNC_ATTEMPTS) {
    console.error(`[LOCAL-PREVIEW] INTERNAL_SERVICE_KEY sync failed after ${MAX_SYNC_ATTEMPTS} attempts, giving up`);
    return false;
  }
  _syncAttempts++;
  try {
    const ourKey = config.INTERNAL_SERVICE_KEY;
    if (!ourKey) return false;

    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (config.DOCKER_HOST && !config.DOCKER_HOST.includes('://')) {
      env.DOCKER_HOST = `unix://${config.DOCKER_HOST}`;
    }

    console.log(`[LOCAL-PREVIEW] Syncing INTERNAL_SERVICE_KEY to sandbox container (attempt ${_syncAttempts}/${MAX_SYNC_ATTEMPTS})...`);
    execSync(
      `docker exec ${config.SANDBOX_CONTAINER_NAME} bash -c "mkdir -p /run/s6/container_environment && ` +
      `printf '%s' '${ourKey}' > /run/s6/container_environment/INTERNAL_SERVICE_KEY && ` +
      `sudo s6-svc -r /run/service/svc-aether-master"`,
      { timeout: 15_000, stdio: 'pipe', env },
    );
    _serviceKeySynced = true;
    console.log('[LOCAL-PREVIEW] INTERNAL_SERVICE_KEY synced, waiting for restart...');
    execSync('sleep 2', { stdio: 'pipe' });
    return true;
  } catch (err: any) {
    console.error(`[LOCAL-PREVIEW] Failed to sync INTERNAL_SERVICE_KEY (attempt ${_syncAttempts}/${MAX_SYNC_ATTEMPTS}):`, err.message || err);
    return false;
  }
}

const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'authorization',
  'connection',
  'keep-alive',
  'te',
  'upgrade',
]);

const STRIP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

export function getSandboxBaseUrl(sandboxId: string): string {
  if (config.SANDBOX_NETWORK) {
    return `http://${sandboxId}:8000`;
  }
  return `http://localhost:${config.SANDBOX_PORT_BASE}`;
}

export async function proxyToSandbox(
  sandboxId: string,
  port: number,
  method: string,
  path: string,
  queryString: string,
  incomingHeaders: Headers,
  incomingBody: ArrayBuffer | undefined,
  _acceptsSSE: boolean,
  origin: string,
  baseUrlOverride?: string,
  serviceKeyOverride?: string,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const sandboxBaseUrl = baseUrlOverride || getSandboxBaseUrl(sandboxId);
  const targetUrl = port === AETHER_MASTER_PORT
    ? `${sandboxBaseUrl}${path}${queryString}`
    : `${sandboxBaseUrl}/proxy/${port}${path}${queryString}`;

  const headers = new Headers();
  for (const [key, value] of incomingHeaders.entries()) {
    if (STRIP_REQUEST_HEADERS.has(key.toLowerCase())) continue;
    headers.set(key, value);
  }
  headers.set('Host', new URL(sandboxBaseUrl).host);
  const serviceKey = serviceKeyOverride || config.INTERNAL_SERVICE_KEY;
  if (serviceKey) {
    headers.set('Authorization', `Bearer ${serviceKey}`);
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }

  const originalHost = incomingHeaders.get('host');
  if (originalHost) {
    const proto = incomingHeaders.get('x-forwarded-proto') || 'http';
    headers.set('X-Forwarded-Prefix', `${proto}://${originalHost}/v1/p/${sandboxId}/${port}`);
  }

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: incomingBody,
    signal: controller.signal,
    // @ts-ignore — Bun extension: no decompression, raw byte passthrough
    decompress: false,
    redirect: 'manual',
  });

  clearTimeout(connectTimer);

  function sanitizeResponseHeaders(input: Headers): Headers {
    const out = new Headers(input);
    for (const key of STRIP_RESPONSE_HEADERS) out.delete(key);
    return out;
  }

  if (response.status === 401 && !_serviceKeySynced && !baseUrlOverride) {
    const synced = trySyncServiceKey();
    if (synced) {
      const retryController = new AbortController();
      const retryTimer = setTimeout(() => retryController.abort(), FETCH_TIMEOUT_MS);
      const retryResponse = await fetch(targetUrl, {
        method,
        headers,
        body: incomingBody,
        signal: retryController.signal,
        // @ts-ignore
        decompress: false,
        redirect: 'manual',
      });
      clearTimeout(retryTimer);
      const retryHeaders = sanitizeResponseHeaders(retryResponse.headers);
      if (origin) {
        retryHeaders.set('Access-Control-Allow-Origin', origin);
        retryHeaders.set('Access-Control-Allow-Credentials', 'true');
      }
      return new Response(retryResponse.body, {
        status: retryResponse.status,
        statusText: retryResponse.statusText,
        headers: retryHeaders,
      });
    }
  }

  const isSSEResponse = (response.headers.get('content-type') || '').includes('text/event-stream');
  if (response.status >= 500 && !isSSEResponse) {
    try {
      const cloned = response.clone();
      const text = await cloned.text();
      const snippet = text.slice(0, 300);
      try {
        const parsed = JSON.parse(snippet);
        const errMsg = parsed?.data?.message || parsed?.message || parsed?.error || snippet.slice(0, 150);
        console.error(`[PREVIEW] Sandbox ${response.status} on ${method} ${path} (port ${port}): ${errMsg}`);
      } catch {
        if (snippet.includes('__bunfallback') || snippet.includes('BunError')) {
          console.error(`[PREVIEW] Sandbox ${response.status} on ${method} ${path} (port ${port}): Bun crash/module error (check sandbox logs)`);
        } else {
          console.error(`[PREVIEW] Sandbox ${response.status} on ${method} ${path} (port ${port}): ${snippet || '(empty)'}`);
        }
      }
    } catch {
      console.error(`[PREVIEW] Sandbox ${response.status} on ${method} ${path} (port ${port})`);
    }
  }

  const respHeaders = sanitizeResponseHeaders(response.headers);
  if (origin) {
    respHeaders.set('Access-Control-Allow-Origin', origin);
    respHeaders.set('Access-Control-Allow-Credentials', 'true');
  }

  const location = respHeaders.get('location');
  if (location && port !== AETHER_MASTER_PORT) {
    const proxyPrefix = `/proxy/${port}`;
    if (location.startsWith(proxyPrefix)) {
      respHeaders.set('location', location.slice(proxyPrefix.length) || '/');
    }
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: respHeaders,
  });
}
