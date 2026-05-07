import { config } from './config'

// ─── Blocked ports (same list as the HTTP proxy router) ────────────────────
const WS_BLOCKED_PORTS = new Set([config.PORT])

// ─── WebSocket constants ───────────────────────────────────────────────────
const WS_CONNECT_TIMEOUT_MS = 10_000
const WS_BUFFER_MAX_BYTES = 1024 * 1024
const WS_IDLE_TIMEOUT_MS = 5 * 60_000

// ─── Connection tracking ───────────────────────────────────────────────────
let activeConnections = 0

export function getActiveConnections(): number {
  return activeConnections
}

// ─── WebSocket data attached to each proxied connection ────────────────────
export interface WsProxyData {
  targetPort: number
  targetPath: string
  upstream: WebSocket | null
  buffered: (string | Buffer | ArrayBuffer)[]
  bufferBytes: number
  connectTimer: ReturnType<typeof setTimeout> | null
  idleTimer: ReturnType<typeof setTimeout> | null
  closed: boolean
}

function clearWsTimers(data: WsProxyData) {
  if (data.connectTimer) { clearTimeout(data.connectTimer); data.connectTimer = null }
  if (data.idleTimer) { clearTimeout(data.idleTimer); data.idleTimer = null }
}

function resetIdleTimer(ws: { data: WsProxyData; close: (code?: number, reason?: string) => void }) {
  if (ws.data.idleTimer) clearTimeout(ws.data.idleTimer)
  ws.data.idleTimer = setTimeout(() => {
    console.warn(`[Aether] WS idle timeout for port ${ws.data.targetPort}`)
    try { ws.close(1000, 'idle timeout') } catch {}
  }, WS_IDLE_TIMEOUT_MS)
}

function parseProxyPath(pathname: string): { port: number; path: string } | null {
  const match = pathname.match(/^\/proxy\/(\d{1,5})(\/.*)?$/)
  if (!match) return null
  const port = parseInt(match[1], 10)
  if (isNaN(port) || port < 1 || port > 65535) return null
  return { port, path: match[2] || '/' }
}

export interface WsServerConfig {
  verifyServiceKey: (candidate: string) => boolean
  loopbackAddrs: Set<string>
  app: any
}

export function createWsServer({ verifyServiceKey, loopbackAddrs, app }: WsServerConfig) {
  return {
    port: config.PORT,
    idleTimeout: 255,

    fetch(req: Request, server: any): Response | Promise<Response> | undefined {
      if ((req.headers.get('accept') || '').includes('text/event-stream')) {
        server.timeout(req, 0)
      }

      if (req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const url = new URL(req.url)

        const wsRemoteAddr = server.requestIP(req)?.address
        const wsIsLocal = !!wsRemoteAddr && loopbackAddrs.has(wsRemoteAddr)

        if (!wsIsLocal) {
          const authHeader = req.headers.get('Authorization')
          let wsToken: string | null = null
          if (authHeader?.startsWith('Bearer ')) wsToken = authHeader.slice(7)
          if (!wsToken) wsToken = url.searchParams.get('token')
          if (!wsToken || !verifyServiceKey(wsToken)) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }
        }

        const parsed = parseProxyPath(url.pathname)

        if (parsed && !WS_BLOCKED_PORTS.has(parsed.port)) {
          const success = server.upgrade(req, {
            data: {
              targetPort: parsed.port,
              targetPath: parsed.path + url.search,
              upstream: null,
              buffered: [],
              bufferBytes: 0,
              connectTimer: null,
              idleTimer: null,
              closed: false,
            } satisfies WsProxyData,
          })
          if (success) return undefined
        }

        if (!parsed) {
          const success = server.upgrade(req, {
            data: {
              targetPort: config.OPENCODE_PORT,
              targetPath: url.pathname + url.search,
              upstream: null,
              buffered: [],
              bufferBytes: 0,
              connectTimer: null,
              idleTimer: null,
              closed: false,
            } satisfies WsProxyData,
          })
          if (success) return undefined
        }
      }

      const remoteAddr = server.requestIP(req)?.address
      return app.fetch(req, { remoteAddr })
    },

    websocket: {
      open(ws: { data: WsProxyData; send: (data: any) => void; close: (code?: number, reason?: string) => void }) {
        activeConnections++
        const { targetPort, targetPath } = ws.data
        const upstreamUrl = `ws://localhost:${targetPort}${targetPath}`

        resetIdleTimer(ws)

        ws.data.connectTimer = setTimeout(() => {
          if (ws.data.upstream?.readyState === WebSocket.CONNECTING) {
            console.warn(`[Aether] WS upstream connect timeout for port ${targetPort}`)
            try { ws.data.upstream.close() } catch {}
            try { ws.close(1011, 'upstream connect timeout') } catch {}
          }
        }, WS_CONNECT_TIMEOUT_MS)

        try {
          const upstream = new WebSocket(upstreamUrl)
          ws.data.upstream = upstream

          upstream.addEventListener('open', () => {
            if (ws.data.connectTimer) { clearTimeout(ws.data.connectTimer); ws.data.connectTimer = null }
            for (const msg of ws.data.buffered) {
              upstream.send(msg)
            }
            ws.data.buffered = []
            ws.data.bufferBytes = 0
          })

          upstream.addEventListener('message', (e: MessageEvent) => {
            resetIdleTimer(ws)
            try { ws.send(e.data) } catch {
              try { upstream.close() } catch {}
            }
          })

          upstream.addEventListener('close', (e: CloseEvent) => {
            if (!ws.data.closed) {
              try { ws.close(e.code || 1000, e.reason || '') } catch {}
            }
          })

          upstream.addEventListener('error', () => {
            console.warn(`[Aether] WS upstream error for port ${targetPort} (path: ${targetPath})`)
            if (!ws.data.closed) {
              try { ws.close(1011, 'upstream error') } catch {}
            }
          })
        } catch (err) {
          console.error(`[Aether] WS proxy failed to connect to port ${targetPort}:`, err)
          try { ws.close(1011, 'upstream connection failed') } catch {}
        }
      },

      message(ws: { data: WsProxyData; close: (code?: number, reason?: string) => void }, message: string | Buffer) {
        resetIdleTimer(ws)
        const upstream = ws.data.upstream
        if (upstream && upstream.readyState === WebSocket.OPEN) {
          upstream.send(message)
        } else if (upstream && upstream.readyState === WebSocket.CONNECTING) {
          const size = typeof message === 'string' ? message.length : (message as Buffer).byteLength
          if (ws.data.bufferBytes + size > WS_BUFFER_MAX_BYTES) {
            console.warn(`[Aether] WS buffer overflow for port ${ws.data.targetPort}, closing`)
            try { ws.close(1011, 'buffer overflow') } catch {}
            return
          }
          ws.data.buffered.push(message)
          ws.data.bufferBytes += size
        }
      },

      close(ws: { data: WsProxyData }) {
        activeConnections--
        ws.data.closed = true
        clearWsTimers(ws.data)
        try { ws.data.upstream?.close() } catch {}
        ws.data.upstream = null
        ws.data.buffered = []
        ws.data.bufferBytes = 0
      },
    },
  }
}
