/**
 * WebSocket proxy helpers for sandbox PTY/SSE forwarding.
 * Handles connection lifecycle, buffering, idle timeouts, and provider dispatch.
 */

import { config } from '../config';
import { getSandboxBaseUrl } from '../sandbox-proxy/routes/local-preview';

// ── Constants ────────────────────────────────────────────────────────────────

export const WS_CONNECT_TIMEOUT_MS = 10_000;
export const WS_BUFFER_MAX_BYTES = 1024 * 1024; // 1MB
export const WS_IDLE_TIMEOUT_MS = 5 * 60_000;   // 5min

// ── Types ────────────────────────────────────────────────────────────────────

export interface WsProxyData {
  targetUrl: string;
  upstreamHeaders?: Record<string, string>;
  upstream: WebSocket | null;
  buffered: (string | Buffer | ArrayBuffer)[];
  bufferBytes: number;
  connectTimer: ReturnType<typeof setTimeout> | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
  closed: boolean;
}

// ── Timer helpers ────────────────────────────────────────────────────────────

export function clearWsTimers(data: WsProxyData) {
  if (data.connectTimer) { clearTimeout(data.connectTimer); data.connectTimer = null; }
  if (data.idleTimer) { clearTimeout(data.idleTimer); data.idleTimer = null; }
}

export function resetIdleTimer(ws: { data: WsProxyData; close: (code?: number, reason?: string) => void }) {
  if (ws.data.idleTimer) clearTimeout(ws.data.idleTimer);
  ws.data.idleTimer = setTimeout(() => {
    console.warn(`[sandbox-proxy] WS idle timeout`);
    try { ws.close(1000, 'idle timeout'); } catch {}
  }, WS_IDLE_TIMEOUT_MS);
}

// ── WS target resolution ─────────────────────────────────────────────────────

/** Build WS target URL for local_docker sandbox. */
function buildLocalDockerWsTarget(sandboxId: string, port: number, remainingPath: string, searchParams: URLSearchParams): { url: string; headers?: Record<string, string> } {
  const sandboxBaseUrl = getSandboxBaseUrl(sandboxId);
  const wsBase = sandboxBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
  const targetPath = port === 8000 ? remainingPath : `/proxy/${port}${remainingPath}`;

  const upstreamParams = new URLSearchParams(searchParams);
  upstreamParams.delete('token');
  if (config.INTERNAL_SERVICE_KEY) {
    upstreamParams.set('token', config.INTERNAL_SERVICE_KEY);
  }
  const search = upstreamParams.toString() ? `?${upstreamParams.toString()}` : '';
  return { url: `${wsBase}${targetPath}${search}` };
}

/** Build WS target URL for justavps sandbox (routes through CF Worker proxy). */
function buildJustavpsWsTarget(opts: {
  port: number;
  remainingPath: string;
  slug: string;
  serviceKey?: string;
  proxyToken?: string;
}): { url: string; headers?: Record<string, string> } {
  const proxyDomain = config.JUSTAVPS_PROXY_DOMAIN;
  const cfBase = `wss://${opts.port}--${opts.slug}.${proxyDomain}`;
  const params = new URLSearchParams();
  if (opts.serviceKey) params.set('token', opts.serviceKey);
  const search = params.toString() ? `?${params.toString()}` : '';
  const headers: Record<string, string> = {};
  if (opts.proxyToken) headers['X-Proxy-Token'] = opts.proxyToken;
  return { url: `${cfBase}${opts.remainingPath}${search}`, headers };
}

/**
 * Resolve the upstream WebSocket target for a sandbox, dispatching by provider.
 * Each provider builds the URL + auth headers differently.
 */
export function resolveWsTarget(
  provider: string,
  opts: {
    sandboxId: string;
    port: number;
    remainingPath: string;
    searchParams: URLSearchParams;
    slug?: string;
    serviceKey?: string;
    proxyToken?: string;
  },
): { url: string; headers?: Record<string, string> } {
  switch (provider) {
    case 'justavps':
      if (!opts.slug) break;
      return buildJustavpsWsTarget({
        port: opts.port,
        remainingPath: opts.remainingPath,
        slug: opts.slug,
        serviceKey: opts.serviceKey,
        proxyToken: opts.proxyToken,
      });

    default:
      break;
  }

  return buildLocalDockerWsTarget(opts.sandboxId, opts.port, opts.remainingPath, opts.searchParams);
}
