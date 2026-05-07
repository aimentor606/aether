import { readFileSync } from 'fs'
import { join, resolve } from 'path'
import type { RegisteredServiceSpec } from './service-types'

export const WORKSPACE_ROOT = process.env.AETHER_WORKSPACE || '/workspace'
export const SERVICE_STATE_DIR = join(WORKSPACE_ROOT, '.kortix', 'services')
export const REGISTRY_FILE = join(SERVICE_STATE_DIR, 'registry.json')
export const LOG_DIR = join(SERVICE_STATE_DIR, 'logs')
export const PORT_MIN = 10_000
export const PORT_MAX = 65_535
export const INSTALL_TIMEOUT_MS = 120_000
export const BUILD_TIMEOUT_MS = 120_000
export const START_WAIT_MS = 30_000
export const PERSISTED_SOURCE_ROOT = '/workspace'
export const ECONNRESET_GUARD_PATH = '/ephemeral/master/econnreset-guard.cjs'

export function nowIso(): string {
  return new Date().toISOString()
}

export function cloneServiceSpec(spec: RegisteredServiceSpec): RegisteredServiceSpec {
  return {
    ...spec,
    envVarKeys: [...spec.envVarKeys],
    deps: [...spec.deps],
    processPatterns: [...spec.processPatterns],
    healthCheck: { ...spec.healthCheck },
  }
}

export function buildNodeOptions(): string {
  const existing = process.env.NODE_OPTIONS || ''
  const guardRequire = `--require=${ECONNRESET_GUARD_PATH}`
  if (existing.includes(guardRequire)) return existing
  return `${existing} ${guardRequire}`.trim()
}

export function resolveSourcePath(sourcePath?: string | null): string {
  if (!sourcePath) return PERSISTED_SOURCE_ROOT
  if (sourcePath.startsWith('/')) return sourcePath
  return resolve(PERSISTED_SOURCE_ROOT, sourcePath)
}

export function sortServices(specs: RegisteredServiceSpec[]): RegisteredServiceSpec[] {
  const byId = new Map(specs.map((service) => [service.id, service]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const ordered: RegisteredServiceSpec[] = []

  function visit(id: string): void {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new Error(`Cycle detected in service dependencies at ${id}`)
    const spec = byId.get(id)
    if (!spec) throw new Error(`Service dependency not found: ${id}`)
    visiting.add(id)
    for (const dep of spec.deps) visit(dep)
    visiting.delete(id)
    visited.add(id)
    ordered.push(spec)
  }

  for (const spec of specs) visit(spec.id)
  return ordered
}

export function splitCommand(command: string): string[] {
  const matches = command.match(/"[^"]*"|'[^']*'|[^\s]+/g) || []
  return matches.map((token) => token.replace(/^['"]|['"]$/g, ''))
}

export function normalizeCommandParts(parts: string[]): string[] {
  if (parts[0] === 'bun') {
    return [process.execPath, ...parts.slice(1)]
  }
  return parts
}

export async function runShell(
  cmd: string,
  cwd: string,
  env?: Record<string, string>,
  timeoutMs: number = 60_000,
): Promise<{ ok: boolean; output: string }> {
  const mergedEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...env,
    CI: '1',
    FORCE_COLOR: '0',
  }

  if (!cmd.trim()) return { ok: false, output: 'Empty command' }

  let proc: ReturnType<typeof Bun.spawn>
  try {
    proc = Bun.spawn(['/bin/sh', '-c', cmd], {
      cwd,
      env: mergedEnv,
      stdout: 'pipe',
      stderr: 'pipe',
    })
  } catch (err) {
    return { ok: false, output: String(err) }
  }

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    try { proc.kill() } catch {}
  }, timeoutMs)

  try {
    const [stdoutBuf, stderrBuf] = await Promise.all([
      new Response(proc.stdout as ReadableStream<Uint8Array> | null).text(),
      new Response(proc.stderr as ReadableStream<Uint8Array> | null).text(),
    ])
    const exitCode = await proc.exited
    clearTimeout(timer)
    const output = `${stdoutBuf}\n${stderrBuf}`.trim()
    if (timedOut) return { ok: false, output: `${output}\n[TIMEOUT after ${timeoutMs}ms]`.trim() }
    return { ok: exitCode === 0, output }
  } catch (err) {
    clearTimeout(timer)
    return { ok: false, output: String(err) }
  }
}

export async function testPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const server = Bun.serve({
        port,
        fetch() {
          return new Response('')
        },
      })
      server.stop(true)
      resolve(true)
    } catch {
      resolve(false)
    }
  })
}

export async function findAvailablePort(): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const port = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN))
    if (await testPortAvailable(port)) return port
  }
  throw new Error('Could not find an available port after 50 attempts')
}

export async function probeTcpPort(port: number, timeoutMs: number = 2000): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}`, { signal: AbortSignal.timeout(timeoutMs) })
    await res.arrayBuffer().catch(() => {})
    return true
  } catch {
    try {
      const net = require('net')
      return await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: '127.0.0.1', port })
        const timer = setTimeout(() => {
          socket.destroy()
          resolve(false)
        }, timeoutMs)
        socket.once('connect', () => {
          clearTimeout(timer)
          socket.end()
          resolve(true)
        })
        socket.once('error', () => {
          clearTimeout(timer)
          resolve(false)
        })
      })
    } catch {
      return false
    }
  }
}

export async function waitForPort(port: number, timeoutMs: number = START_WAIT_MS): Promise<boolean> {
  const start = Date.now()
  while ((Date.now() - start) < timeoutMs) {
    if (await probeTcpPort(port, 1500)) return true
    await Bun.sleep(500)
  }
  return false
}

export async function waitForPortToClose(port: number, timeoutMs: number = 10_000): Promise<boolean> {
  const start = Date.now()
  while ((Date.now() - start) < timeoutMs) {
    if (!(await probeTcpPort(port, 1000))) return true
    await Bun.sleep(300)
  }
  return false
}

export async function findPidByPattern(pattern: string): Promise<number | null> {
  const result = await runShell(`pgrep -f ${JSON.stringify(pattern)}`, WORKSPACE_ROOT, undefined, 5000)
  if (!result.ok || !result.output) return null
  const value = parseInt(result.output.split(/\s+/)[0] || '', 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

export async function findPidByPort(port: number): Promise<number | null> {
  const commands = [
    `lsof -ti tcp:${port} -sTCP:LISTEN`,
    `fuser -n tcp ${port}`,
  ]

  for (const command of commands) {
    const result = await runShell(command, WORKSPACE_ROOT, undefined, 5000)
    if (!result.ok || !result.output) continue
    const value = parseInt(result.output.split(/\s+/)[0] || '', 10)
    if (Number.isFinite(value) && value > 0) return value
  }

  return null
}

export function getInnerNsPid(procPid: number): number | null {
  try {
    const status = readFileSync(`/proc/${procPid}/status`, 'utf-8')
    const nspidLine = status.split('\n').find((line) => line.startsWith('NSpid:'))
    if (!nspidLine) return null
    const nspids = nspidLine.split(/\s+/).slice(1).map(Number)
    const innerPid = nspids[nspids.length - 1]
    return (!Number.isNaN(innerPid) && innerPid > 0) ? innerPid : null
  } catch {
    return null
  }
}
