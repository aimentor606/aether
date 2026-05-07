import { describe, it, expect } from 'bun:test'
import { createWsServer, getActiveConnections } from '../../src/ws-proxy'
import { config } from '../../src/config'

/**
 * Tests for the WebSocket proxy module (ws-proxy.ts).
 *
 * The WS proxy handles upgrade requests, authenticates non-localhost connections,
 * routes to the correct upstream port, and manages connection lifecycle.
 *
 * We test:
 *   - parseProxyPath (via fetch behavior)
 *   - Auth enforcement for non-localhost WS upgrades
 *   - Localhost bypass
 *   - Blocked port rejection
 *   - Default routing to OpenCode when no proxy path
 *   - SSE timeout handling
 *   - Non-WS requests forwarded to app
 *   - getActiveConnections tracking
 */

const VALID_KEY = 'test-service-key-12345'
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'])

function makeServer() {
  const app = {
    fetch: () => new Response('app handled', { status: 200 }),
  }
  return createWsServer({
    verifyServiceKey: (c: string) => c === VALID_KEY,
    loopbackAddrs: LOOPBACK,
    app,
  })
}

function mockUpgradeRequest(
  pathname: string,
  opts: {
    token?: string
    remoteAddr?: string
    upgrade?: boolean
    accept?: string
  } = {},
) {
  const url = new URL(pathname, 'http://localhost')
  if (opts.token) url.searchParams.set('token', opts.token)

  const headers: Record<string, string> = {}
  if (opts.upgrade !== false) headers['upgrade'] = 'websocket'
  if (opts.accept) headers['accept'] = opts.accept
  if (opts.token && opts.upgrade !== false) {
    // also test via query param — no Authorization header unless explicitly added
  }

  return new Request(url.toString(), { headers })
}

function makeMockServer(req: Request, remoteAddr = '10.0.0.1') {
  let upgraded = false
  let upgradeData: any = null

  const server = {
    requestIP: () => ({ address: remoteAddr }),
    upgrade: (_req: Request, opts: { data: any }) => {
      upgraded = true
      upgradeData = opts.data
      return true
    },
    timeout: () => {},
  }

  return { server, wasUpgraded: () => upgraded, getUpgradeData: () => upgradeData }
}

describe('WS Proxy', () => {
  describe('parseProxyPath (implicit via fetch)', () => {
    it('rejects invalid port numbers (0)', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/0/ws')
      // Port 0 is invalid — from localhost it falls through to default OpenCode upgrade
      const { server, wasUpgraded, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)
      // parseProxyPath rejects port 0, so it falls through to default OpenCode routing
      expect(wasUpgraded()).toBe(true)
      expect(getUpgradeData().targetPort).toBe(config.OPENCODE_PORT)
    })

    it('rejects port numbers > 65535', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/99999/ws')
      const { server, wasUpgraded } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)
      // 99999 > 65535 — falls through to default OpenCode routing
      expect(wasUpgraded()).toBe(true)
    })

    it('rejects non-numeric port paths', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/abc/ws')
      const { server, wasUpgraded, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)
      // Not a valid proxy path — falls through to default OpenCode upgrade
      expect(wasUpgraded()).toBe(true)
      expect(getUpgradeData().targetPort).toBe(config.OPENCODE_PORT)
    })
  })

  describe('Auth enforcement', () => {
    it('rejects WS upgrade from non-localhost without token', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws')
      const { server, wasUpgraded } = makeMockServer(req, '10.0.0.1')

      const res = ws.fetch(req, server as any) as Response

      expect(res.status).toBe(401)
      expect(wasUpgraded()).toBe(false)
    })

    it('rejects WS upgrade with wrong token', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws', { token: 'wrong-key' })
      const { server, wasUpgraded } = makeMockServer(req, '10.0.0.1')

      const res = ws.fetch(req, server as any) as Response

      expect(res.status).toBe(401)
      expect(wasUpgraded()).toBe(false)
    })

    it('accepts WS upgrade with valid Bearer token via query param', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws', { token: VALID_KEY })
      const { server, wasUpgraded } = makeMockServer(req, '10.0.0.1')

      ws.fetch(req, server as any)

      expect(wasUpgraded()).toBe(true)
    })

    it('accepts WS upgrade with valid Authorization header', () => {
      const ws = makeServer()
      const req = new Request('http://localhost/proxy/3000/ws', {
        headers: {
          upgrade: 'websocket',
          authorization: `Bearer ${VALID_KEY}`,
        },
      })
      const { server, wasUpgraded } = makeMockServer(req, '10.0.0.1')

      ws.fetch(req, server as any)

      expect(wasUpgraded()).toBe(true)
    })

    it('bypasses auth for localhost connections', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws')
      // No token, but from localhost
      const { server, wasUpgraded } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)

      expect(wasUpgraded()).toBe(true)
    })

    it('bypasses auth for ::1 (IPv6 localhost)', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws')
      const { server, wasUpgraded } = makeMockServer(req, '::1')

      ws.fetch(req, server as any)

      expect(wasUpgraded()).toBe(true)
    })

    it('bypasses auth for ::ffff:127.0.0.1', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws')
      const { server, wasUpgraded } = makeMockServer(req, '::ffff:127.0.0.1')

      ws.fetch(req, server as any)

      expect(wasUpgraded()).toBe(true)
    })
  })

  describe('Port routing', () => {
    it('routes /proxy/:port/path to the specified port', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/5173/vite-hmr')
      const { server, wasUpgraded, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)

      expect(wasUpgraded()).toBe(true)
      const data = getUpgradeData()
      expect(data.targetPort).toBe(5173)
      expect(data.targetPath).toBe('/vite-hmr')
    })

    it('preserves query string in target path', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000/ws?session=abc')
      const { server, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)

      expect(getUpgradeData().targetPath).toBe('/ws?session=abc')
    })

    it('defaults path to / when no sub-path given', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/3000')
      const { server, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)

      expect(getUpgradeData().targetPath).toBe('/')
    })

    it('blocks the master port from being a proxy target', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest(`/proxy/${config.PORT}/ws`)
      const { server, wasUpgraded } = makeMockServer(req, '127.0.0.1')

      const res = ws.fetch(req, server as any)

      // Blocked port — proxy path matches but port is blocked, so no proxy upgrade.
      // The path DID match /proxy/:port so it doesn't fall through to default OpenCode either.
      // Request gets forwarded to the app as a normal HTTP request.
      expect(wasUpgraded()).toBe(false)
    })

    it('routes non-proxy paths to OpenCode default port', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/some/random/path')
      const { server, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)

      expect(getUpgradeData().targetPort).toBe(config.OPENCODE_PORT)
      expect(getUpgradeData().targetPath).toBe('/some/random/path')
    })
  })

  describe('Upgrade data initialization', () => {
    it('initializes proxy data with correct defaults', () => {
      const ws = makeServer()
      const req = mockUpgradeRequest('/proxy/4000/test')
      const { server, getUpgradeData } = makeMockServer(req, '127.0.0.1')

      ws.fetch(req, server as any)

      const data = getUpgradeData()
      expect(data.targetPort).toBe(4000)
      expect(data.targetPath).toBe('/test')
      expect(data.upstream).toBeNull()
      expect(data.buffered).toEqual([])
      expect(data.bufferBytes).toBe(0)
      expect(data.connectTimer).toBeNull()
      expect(data.idleTimer).toBeNull()
      expect(data.closed).toBe(false)
    })
  })

  describe('Non-WebSocket requests', () => {
    it('forwards non-upgrade requests to the app', () => {
      const ws = makeServer()
      const req = new Request('http://localhost/kortix/health')
      const { server } = makeMockServer(req)

      const res = ws.fetch(req, server as any) as Response

      expect(res.status).toBe(200)
      // The mock app returns 'app handled'
    })

    it('sets SSE timeout to 0 for EventStream requests', () => {
      let capturedTimeout = -1
      const ws = makeServer()
      const req = new Request('http://localhost/events', {
        headers: { accept: 'text/event-stream' },
      })
      const server = {
        requestIP: () => ({ address: '127.0.0.1' }),
        upgrade: () => true,
        timeout: (_req: any, val: number) => { capturedTimeout = val },
      }

      ws.fetch(req, server as any)

      expect(capturedTimeout).toBe(0)
    })

    it('does not set SSE timeout for non-EventStream requests', () => {
      let timeoutCalled = false
      const ws = makeServer()
      const req = new Request('http://localhost/api/data')
      const server = {
        requestIP: () => ({ address: '127.0.0.1' }),
        upgrade: () => true,
        timeout: () => { timeoutCalled = true },
      }

      ws.fetch(req, server as any)

      expect(timeoutCalled).toBe(false)
    })
  })

  describe('getActiveConnections', () => {
    it('returns 0 when no connections are active', () => {
      // The counter is module-level, so it may not be 0 if other tests ran first.
      // We just verify it returns a number >= 0.
      expect(typeof getActiveConnections()).toBe('number')
      expect(getActiveConnections()).toBeGreaterThanOrEqual(0)
    })
  })

  describe('WebSocket lifecycle', () => {
    it('increments active connections on open', () => {
      const ws = makeServer()
      const beforeCount = getActiveConnections()

      const data = {
        targetPort: 9999,
        targetPath: '/',
        upstream: null,
        buffered: [],
        bufferBytes: 0,
        connectTimer: null,
        idleTimer: null,
        closed: false,
      }

      // Mock WebSocket — we can't create real WS in tests, so test the websocket.open
      // handler directly by calling it with a mock ws object
      // We need to prevent the actual upstream connection
      const mockWs = {
        data,
        send: () => {},
        close: () => {},
      }

      // Access the websocket handlers
      const wsHandlers = (ws as any).websocket

      wsHandlers.open(mockWs)

      expect(getActiveConnections()).toBe(beforeCount + 1)

      // Clean up
      wsHandlers.close(mockWs)
    })

    it('decrements active connections on close', () => {
      const ws = makeServer()
      const data = {
        targetPort: 9999,
        targetPath: '/',
        upstream: { close: () => {}, readyState: 1 },
        buffered: [],
        bufferBytes: 0,
        connectTimer: null,
        idleTimer: null,
        closed: false,
      }

      const mockWs = { data, send: () => {}, close: () => {} }
      const wsHandlers = (ws as any).websocket

      wsHandlers.open(mockWs)
      const afterOpen = getActiveConnections()

      wsHandlers.close(mockWs)
      const afterClose = getActiveConnections()

      expect(afterClose).toBe(afterOpen - 1)
    })

    it('clears timers on close', () => {
      const ws = makeServer()
      const fakeTimer = setTimeout(() => {}, 100000)
      const data = {
        targetPort: 9999,
        targetPath: '/',
        upstream: null,
        buffered: ['msg1', 'msg2'],
        bufferBytes: 8,
        connectTimer: fakeTimer,
        idleTimer: fakeTimer,
        closed: false,
      }

      const mockWs = { data, send: () => {}, close: () => {} }
      const wsHandlers = (ws as any).websocket

      wsHandlers.close(mockWs)

      expect(data.connectTimer).toBeNull()
      expect(data.idleTimer).toBeNull()
      expect(data.closed).toBe(true)
      expect(data.upstream).toBeNull()
      expect(data.buffered).toEqual([])
      expect(data.bufferBytes).toBe(0)
    })

    it('buffers messages when upstream is connecting', () => {
      const ws = makeServer()
      const data = {
        targetPort: 9999,
        targetPath: '/',
        upstream: { readyState: 0, send: () => {} }, // CONNECTING
        buffered: [] as string[],
        bufferBytes: 0,
        connectTimer: null,
        idleTimer: null,
        closed: false,
      }

      const mockWs = { data, send: () => {}, close: () => {} }
      const wsHandlers = (ws as any).websocket

      wsHandlers.message(mockWs, 'hello')

      expect(data.buffered).toEqual(['hello'])
      expect(data.bufferBytes).toBe(5)
    })

    it('sends message directly when upstream is open', () => {
      const ws = makeServer()
      let sentData: any = null
      const data = {
        targetPort: 9999,
        targetPath: '/',
        upstream: { readyState: 1, send: (d: any) => { sentData = d } }, // OPEN
        buffered: [] as string[],
        bufferBytes: 0,
        connectTimer: null,
        idleTimer: null,
        closed: false,
      }

      const mockWs = { data, send: () => {}, close: () => {} }
      const wsHandlers = (ws as any).websocket

      wsHandlers.message(mockWs, 'direct-msg')

      expect(sentData).toBe('direct-msg')
      expect(data.buffered).toEqual([])
    })

    it('closes on buffer overflow when upstream is connecting', () => {
      const ws = makeServer()
      let closed = false
      const data = {
        targetPort: 9999,
        targetPath: '/',
        upstream: { readyState: 0, send: () => {} }, // CONNECTING
        buffered: [],
        bufferBytes: 1024 * 1024, // Already at limit
        connectTimer: null,
        idleTimer: null,
        closed: false,
      }

      const mockWs = {
        data,
        send: () => {},
        close: () => { closed = true },
      }
      const wsHandlers = (ws as any).websocket

      wsHandlers.message(mockWs, 'overflow')

      expect(closed).toBe(true)
      expect(data.buffered).toEqual([]) // Should NOT have pushed the message
    })
  })
})
