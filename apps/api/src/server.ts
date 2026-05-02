import type { Hono } from 'hono';
import { config } from './config';
import { wsHandlers as tunnelWsHandlers } from './tunnel';
import { isSchemaReady } from './startup/services';

export function createServerConfig(app: Hono) {
  return {
    port: config.PORT,

    async fetch(req: Request, server: any): Promise<Response | undefined> {
      const url = new URL(req.url);
      const isWsUpgrade = req.headers.get('upgrade')?.toLowerCase() === 'websocket';

      if (isWsUpgrade && url.pathname === '/v1/tunnel/ws') {
        if (!isSchemaReady()) {
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
}
