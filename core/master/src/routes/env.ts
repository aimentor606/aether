import { Hono } from 'hono'
import { describeRoute, resolver } from 'hono-openapi'
import { readFileSync, readdirSync } from 'fs'
import { SecretStore } from '../services/secret-store'
import { EnvSync } from '../services/env-sync'
import {
  ErrorResponse,
  UnauthorizedResponse,
  SecretsListResponse,
  SetBulkEnvResponse,
  SetSingleEnvResponse,
  DeleteEnvResponse,
  RotateTokenResponse,
} from '../schemas/common'

const envRouter = new Hono()
const envSync = new EnvSync(new SecretStore())

// NOTE: Per-route auth middleware removed — global auth in index.ts now
// always enforces INTERNAL_SERVICE_KEY on all routes (auto-generated if not set).

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function safeJsonBody(c: any): Promise<any | null> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

function isValidEnvKey(key: string): boolean {
  return !!key && key.length <= 255 && !key.includes('/') && !key.includes('\0')
}

/**
 * Get the innermost PID namespace PID for a given /proc entry.
 * Returns the PID to use with process.kill() from within this namespace.
 */
function getInnerNsPid(procPid: number): number | null {
  try {
    const status = readFileSync(`/proc/${procPid}/status`, 'utf-8')
    const nspidLine = status.split('\n').find(l => l.startsWith('NSpid:'))
    if (!nspidLine) return null
    const nspids = nspidLine.split(/\s+/).slice(1).map(Number)
    const innerPid = nspids[nspids.length - 1]
    return (!isNaN(innerPid) && innerPid > 0) ? innerPid : null
  } catch {
    return null
  }
}

async function restartServices(services?: string[]): Promise<void> {
  // Kill supervised processes directly so s6 auto-restarts them with fresh env.
  //
  // The opencode CLI is a Node wrapper → native binary chain. s6-svc -r
  // only SIGTERMs the supervised PID and doesn't propagate to grandchildren.
  //
  // CRITICAL: This container uses `unshare --pid` creating a nested PID
  // namespace. `pgrep`/`kill`/`killall` all fail because they resolve PIDs
  // in the outer namespace but kill() operates in the inner namespace.
  // We read NSpid from /proc/{pid}/status to get the inner namespace PID.
  const restartAll = !services || services.length === 0
  const restartOpencode = restartAll || services?.includes('opencode')

  try {
    const killed: number[] = []

    for (const entry of readdirSync('/proc')) {
      const pid = parseInt(entry, 10)
      if (isNaN(pid) || pid <= 1) continue
      try {
        const comm = readFileSync(`/proc/${pid}/comm`, 'utf-8').trim()
        // Kill native opencode binaries (comm="opencode")
        if (restartOpencode && comm === 'opencode') {
          const innerPid = getInnerNsPid(pid)
          if (innerPid) {
            process.kill(innerPid, 9)
            killed.push(innerPid)
          }
          continue
        }
        // Kill node/bun wrappers by cmdline
        if (comm === 'node' || comm === 'MainThread' || comm === 'bun') {
          const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf-8')
          if (restartOpencode && cmdline.includes('/usr/local/bin/opencode')) {
            const innerPid = getInnerNsPid(pid)
            if (innerPid) {
              process.kill(innerPid, 9)
              killed.push(innerPid)
            }
            continue
          }
        }
      } catch {}
    }

    console.log(`[ENV API] restart services: killed inner pids=${killed.join(',') || 'none'}`)
    // s6 detects longrun died → auto-restarts with fresh env via with-contenv.
  } catch (e) {
    console.error(`[ENV API] restart services: error=${e}`)
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// NOTE: Tools use getEnv() which hot-reads from the s6 env directory (tmpfs).
// Setting a key writes the s6 env file, making it instantly available to tools
// WITHOUT restarting OpenCode. Restart is ONLY used by rotate-token (which
// changes the encryption key and requires a fresh process). Normal set/delete
// operations never restart.

// GET /env — list all secrets (full values).
envRouter.get('/',
  describeRoute({
    tags: ['Secrets'],
    summary: 'List all secrets',
    description: 'Returns all stored environment variables / secrets with their full values.',
    responses: {
      200: { description: 'Secret list', content: { 'application/json': { schema: resolver(SecretsListResponse) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const envVars = await envSync.getAll()
      return c.json({ secrets: envVars })
    } catch (error) {
      console.error('[ENV API] Error listing:', error)
      return c.json({ error: 'Failed to list environment variables' }, 500)
    }
  },
)

// POST /env — set multiple keys at once. { keys: { K: V, ... } }
// All vars are written to the s6 env dir and picked up live via getEnv().
// This route NEVER restarts OpenCode. The only restart path is the dedicated
// POST /env/rotate-token endpoint (explicit token rotation).
envRouter.post('/',
  describeRoute({
    tags: ['Secrets'],
    summary: 'Set multiple secrets',
    description: 'Bulk-set environment variables. All vars are written to the s6 env dir and available immediately via getEnv(). Never restarts services.',
    responses: {
      200: { description: 'Keys updated', content: { 'application/json': { schema: resolver(SetBulkEnvResponse) } } },
      400: { description: 'Invalid body', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const body = await safeJsonBody(c)
      if (!body) return c.json({ error: 'Invalid JSON body' }, 400)
      const keys = body?.keys
      if (!keys || typeof keys !== 'object') {
        return c.json({ error: 'Request body must contain a "keys" object' }, 400)
      }
      let updated = 0
      for (const [key, value] of Object.entries(keys as Record<string, unknown>)) {
        if (typeof value !== 'string') continue
        await envSync.set(key, value)
        updated++
      }
      return c.json({ ok: true, updated, restarted: false })
    } catch (error) {
      console.error('[ENV API] Error setting bulk:', error)
      return c.json({ error: 'Failed to set environment variables' }, 500)
    }
  },
)

// GET /env/:key — get a single key (raw value).
envRouter.get('/:key',
  describeRoute({
    tags: ['Secrets'],
    summary: 'Get a single secret',
    description: 'Returns the value of a single secret by key. Returns 200 with null value when key does not exist.',
    responses: {
      200: { description: 'Secret value (key→value object)', content: { 'application/json': { schema: resolver(z.record(z.string(), z.string().nullable())) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const key = c.req.param('key')
      if (!isValidEnvKey(key)) return c.json({ error: 'Invalid key' }, 400)
      const value = await envSync.get(key)
      // Return 200 with null value when key doesn't exist — avoids 404 retry loops
      // in the frontend (e.g. ONBOARDING_COMPLETE before first onboarding).
      return c.json({ [key]: value })
    } catch (error) {
      console.error('[ENV API] Error getting key:', error)
      return c.json({ error: 'Failed to get environment variable' }, 500)
    }
  },
)

// POST /env/rotate-token — rotate AETHER_TOKEN.
// Encryption is decoupled from AETHER_TOKEN, so this just updates the token
// value and restarts services. No re-encryption needed.
envRouter.post('/rotate-token',
  describeRoute({
    tags: ['Secrets'],
    summary: 'Rotate AETHER_TOKEN',
    description: 'Rotates the AETHER_TOKEN used for sandbox↔API authentication. Encryption is decoupled — secrets are NOT re-encrypted. Always restarts services.',
    responses: {
      200: { description: 'Token rotated', content: { 'application/json': { schema: resolver(RotateTokenResponse) } } },
      400: { description: 'Invalid body', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const body = await safeJsonBody(c)
      if (!body) return c.json({ error: 'Invalid JSON body' }, 400)
      const newToken = body?.token
      if (!newToken || typeof newToken !== 'string') {
        return c.json({ error: 'Request body must contain a "token" string' }, 400)
      }

      // Update token — encryption is decoupled, no re-encryption needed
      const result = await envSync.rotateToken(newToken)

      // Restart OpenCode to pick up the new token
      await restartServices(['opencode'])

      console.log(`[ENV API] AETHER_TOKEN rotated. ${result.rotated} secret(s) unaffected (encryption decoupled).`)
      return c.json({ ok: true, ...result })
    } catch (error) {
      console.error('[ENV API] Token rotation error:', error)
      return c.json({ error: 'Failed to rotate token' }, 500)
    }
  },
)

// POST /env/:key — set a single key. { value: "..." }
// Never restarts services — tools pick up new values via s6 env dir.
envRouter.post('/:key',
  describeRoute({
    tags: ['Secrets'],
    summary: 'Set a single secret',
    description: 'Sets a single environment variable. Does NOT restart services — tools pick up values via s6 env dir instantly.',
    responses: {
      200: { description: 'Key set', content: { 'application/json': { schema: resolver(SetSingleEnvResponse) } } },
      400: { description: 'Invalid body', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const key = c.req.param('key')
      if (!isValidEnvKey(key)) return c.json({ error: 'Invalid key' }, 400)
      const body = await safeJsonBody(c)
      if (!body) return c.json({ error: 'Invalid JSON body' }, 400)
      if (!body || typeof body.value !== 'string') {
        return c.json({ error: 'Request body must contain a "value" field' }, 400)
      }
      await envSync.set(key, body.value)
      return c.json({ ok: true, key, restarted: false })
    } catch (error) {
      console.error('[ENV API] Error setting key:', error)
      return c.json({ error: 'Failed to set environment variable' }, 500)
    }
  },
)

// PUT /env/:key — alias for POST (frontend uses PUT for set).
// Never restarts services — tools pick up new values via s6 env dir.
envRouter.put('/:key',
  describeRoute({
    tags: ['Secrets'],
    summary: 'Set a single secret (PUT)',
    description: 'Alias for POST /env/:key. Sets a single environment variable. Does NOT restart services.',
    responses: {
      200: { description: 'Key set', content: { 'application/json': { schema: resolver(SetSingleEnvResponse) } } },
      400: { description: 'Invalid body', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const key = c.req.param('key')
      if (!isValidEnvKey(key)) return c.json({ error: 'Invalid key' }, 400)
      const body = await safeJsonBody(c)
      if (!body) return c.json({ error: 'Invalid JSON body' }, 400)
      if (!body || typeof body.value !== 'string') {
        return c.json({ error: 'Request body must contain a "value" field' }, 400)
      }
      await envSync.set(key, body.value)
      return c.json({ ok: true, key, restarted: false })
    } catch (error) {
      console.error('[ENV API] Error setting key:', error)
      return c.json({ error: 'Failed to set environment variable' }, 500)
    }
  },
)

// DELETE /env/:key — remove a key. Deletes from secret store and s6 env dir.
// Does NOT restart services. The s6 env file removal means getEnv() will
// fall back to process.env (stale) but new tool invocations won't see the key.
envRouter.delete('/:key',
  describeRoute({
    tags: ['Secrets'],
    summary: 'Delete a secret',
    description: 'Removes an environment variable. Does NOT restart services.',
    responses: {
      200: { description: 'Key deleted', content: { 'application/json': { schema: resolver(DeleteEnvResponse) } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: resolver(UnauthorizedResponse) } } },
      500: { description: 'Server error', content: { 'application/json': { schema: resolver(ErrorResponse) } } },
    },
  }),
  async (c) => {
    try {
      const key = c.req.param('key')
      if (!isValidEnvKey(key)) return c.json({ error: 'Invalid key' }, 400)
      await envSync.delete(key)
      return c.json({ ok: true, key })
    } catch (error) {
      console.error('[ENV API] Error deleting key:', error)
      return c.json({ error: 'Failed to delete environment variable' }, 500)
    }
  },
)

export default envRouter

// z import needed for inline resolver usage
import { z } from 'zod'
