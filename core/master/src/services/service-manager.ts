import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { join, dirname } from 'path'

// Re-export types for backward compatibility
export type {
  ServiceAdapter, ServiceScope, ServiceStatus, ServiceRestartPolicy, ServiceHealthType,
  ServiceHealthCheck, RegisteredServiceSpec, ServiceStateSnapshot, ManagedService,
  ServiceRegistryFile, FrameworkCommands, LegacyDeploymentConfig, DeployResult,
  ServiceActionResult, RegisterServiceInput, ServiceTemplate,
} from './service-types'

// Re-export extracted modules for backward compatibility
export { detectFramework, getFrameworkCommands, shouldRunInstall, SERVICE_TEMPLATES } from './service-framework'
export {
  nowIso, cloneServiceSpec, buildNodeOptions, resolveSourcePath, sortServices,
  splitCommand, normalizeCommandParts, runShell, testPortAvailable, findAvailablePort,
  probeTcpPort, waitForPort, waitForPortToClose, findPidByPattern, findPidByPort,
  getInnerNsPid, WORKSPACE_ROOT, SERVICE_STATE_DIR, REGISTRY_FILE, LOG_DIR,
  INSTALL_TIMEOUT_MS, BUILD_TIMEOUT_MS, START_WAIT_MS,
} from './service-utils'

import type {
  RegisteredServiceSpec, ServiceStateSnapshot, ManagedService, ServiceRegistryFile,
  ServiceAdapter, ServiceScope, ServiceTemplate, LegacyDeploymentConfig, DeployResult,
  ServiceActionResult, RegisterServiceInput,
} from './service-types'
import { SERVICE_TEMPLATES } from './service-framework'
import { detectFramework, getFrameworkCommands, shouldRunInstall } from './service-framework'
import {
  nowIso, cloneServiceSpec, buildNodeOptions, resolveSourcePath, sortServices,
  runShell, findAvailablePort, findPidByPort, findPidByPattern, getInnerNsPid,
  probeTcpPort, waitForPort, waitForPortToClose,
  WORKSPACE_ROOT, REGISTRY_FILE, LOG_DIR,
  INSTALL_TIMEOUT_MS, BUILD_TIMEOUT_MS, START_WAIT_MS,
} from './service-utils'

const REGISTRY_VERSION = 1

function s6svc(id: string, name: string, scope: ServiceScope, s6Name: string, opts: Partial<RegisteredServiceSpec> = {}): RegisteredServiceSpec {
  return {
    id, name, adapter: 's6', scope, description: '', builtin: true, userVisible: false,
    projectId: null, template: id, framework: null, sourcePath: null,
    sourceType: 'files', sourceRef: null, startCommand: null, installCommand: null, buildCommand: null,
    envVarKeys: [], deps: [], port: null, desiredState: 'running', autoStart: true,
    restartPolicy: 'always', restartDelayMs: 2000, s6ServiceName: s6Name,
    processPatterns: [], healthCheck: { type: 'none' }, createdAt: '', updatedAt: '',
    ...opts,
  }
}

const BUILTIN_SERVICES: RegisteredServiceSpec[] = [
  {
    id: 'opencode-serve', name: 'Agent Runtime API', adapter: 'spawn', scope: 'core', description: '', builtin: true,
    userVisible: false, projectId: null, template: 'opencode-serve', framework: 'node',
    sourcePath: WORKSPACE_ROOT, sourceType: 'files', sourceRef: null,
    startCommand: 'bash /ephemeral/master/scripts/run-opencode-serve.sh',
    installCommand: null, buildCommand: null, envVarKeys: [], deps: [], port: 4096,
    desiredState: 'running', autoStart: true, restartPolicy: 'always', restartDelayMs: 3000,
    s6ServiceName: null, processPatterns: ['opencode serve --port 4096'],
    healthCheck: { type: 'none' }, createdAt: '', updatedAt: '',
  },
  s6svc('chromium-persistent', 'Chromium', 'core', 'svc-chromium-persistent',
    { port: 9222, processPatterns: ['chromium-browser'] }),
  s6svc('agent-browser-session', 'Agent Browser Session', 'core', 'svc-agent-browser-session',
    { deps: ['chromium-persistent'], processPatterns: ['agent-browser-session'] }),
  s6svc('agent-browser-viewer', 'Agent Browser Viewer', 'core', 'svc-agent-browser-viewer',
    { port: 9224, processPatterns: ['agent-browser-viewer.js'] }),
  s6svc('static-web', 'Static Web Server', 'core', 'svc-static-web',
    { port: 3211, processPatterns: ['static-web.js'] }),
  s6svc('lss-sync', 'LSS Sync', 'core', 'svc-lss-sync',
    { envVarKeys: ['OPENAI_API_KEY'], processPatterns: ['lss-sync'] }),
  s6svc('sshd', 'SSH Daemon', 'bootstrap', 'svc-sshd',
    { port: 22, processPatterns: ['sshd -D'] }),
  s6svc('docker', 'Docker Daemon', 'bootstrap', 'svc-docker',
    { processPatterns: ['dockerd'] }),
]

export class ServiceManager {
  private services = new Map<string, ManagedService>()
  private started = false
  private readonly registryFile: string
  private readonly logsDir: string
  private readonly builtins: RegisteredServiceSpec[]

  constructor(options?: { registryFile?: string; logsDir?: string; builtins?: RegisteredServiceSpec[] }) {
    this.registryFile = options?.registryFile || REGISTRY_FILE
    this.logsDir = options?.logsDir || LOG_DIR
    this.builtins = options?.builtins?.map(cloneServiceSpec) || BUILTIN_SERVICES.map(cloneServiceSpec)
  }

  private ensureStorage(): void {
    mkdirSync(dirname(this.registryFile), { recursive: true })
    mkdirSync(this.logsDir, { recursive: true })
  }

  private logFilePath(id: string): string {
    return join(this.logsDir, `${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.log`)
  }

  private pidFilePath(id: string): string {
    return join(this.logsDir, `${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.pid`)
  }

  private appendLog(id: string, line: string): void {
    this.ensureStorage()
    appendFileSync(this.logFilePath(id), `${line.endsWith('\n') ? line : `${line}\n`}`)
  }

  private writePidFile(id: string, pid: number | null): void {
    this.ensureStorage()
    const pidPath = this.pidFilePath(id)
    if (!pid) {
      try { rmSync(pidPath, { force: true }) } catch {}
      return
    }
    writeFileSync(pidPath, String(pid))
  }

  private readPidFile(id: string): number | null {
    try {
      const value = parseInt(readFileSync(this.pidFilePath(id), 'utf-8').trim(), 10)
      return Number.isFinite(value) && value > 0 ? value : null
    } catch {
      return null
    }
  }

  private emptyState(spec: RegisteredServiceSpec): ServiceStateSnapshot {
    return {
      id: spec.id, name: spec.name, adapter: spec.adapter, scope: spec.scope,
      status: 'stopped', desiredState: spec.desiredState, builtin: spec.builtin,
      userVisible: spec.userVisible, pid: null, port: spec.port ?? null,
      framework: spec.framework ?? null, sourcePath: spec.sourcePath ?? null,
      projectId: spec.projectId ?? null, template: spec.template ?? null,
      autoStart: spec.autoStart, restarts: 0, startedAt: null, stoppedAt: null,
      lastError: null, managed: true,
    }
  }

  private hydrateManagedService(spec: RegisteredServiceSpec): ManagedService {
    return { spec, proc: null, state: this.emptyState(spec), intentionallyStopped: false }
  }

  private mergeBuiltins(persisted: RegisteredServiceSpec[]): RegisteredServiceSpec[] {
    const persistedMap = new Map(persisted.map((s) => [s.id, s]))
    const merged: RegisteredServiceSpec[] = []
    for (const builtin of this.builtins) {
      const p = persistedMap.get(builtin.id)
      const now = nowIso()
      const next = cloneServiceSpec(builtin)
      next.createdAt = p?.createdAt || now
      next.updatedAt = now
      if (p) { next.desiredState = p.desiredState || next.desiredState; next.autoStart = p.autoStart ?? next.autoStart; next.port = p.port ?? next.port }
      merged.push(next)
      persistedMap.delete(builtin.id)
    }
    for (const spec of persistedMap.values()) {
      merged.push({ ...cloneServiceSpec(spec), createdAt: spec.createdAt || nowIso(), updatedAt: spec.updatedAt || nowIso() })
    }
    sortServices(merged)
    return merged
  }

  private loadRegistryFromDisk(): RegisteredServiceSpec[] {
    this.ensureStorage()
    let persisted: RegisteredServiceSpec[] = []
    if (existsSync(this.registryFile)) {
      try {
        const raw = JSON.parse(readFileSync(this.registryFile, 'utf-8')) as ServiceRegistryFile
        if (raw.version === REGISTRY_VERSION && Array.isArray(raw.services)) persisted = raw.services
      } catch { /* rebuild */ }
    }
    return this.mergeBuiltins(persisted)
  }

  private persistRegistry(): void {
    this.ensureStorage()
    const payload: ServiceRegistryFile = { version: REGISTRY_VERSION, services: [...this.services.values()].map(({ spec }) => cloneServiceSpec(spec)) }
    const tempPath = `${this.registryFile}.tmp-${process.pid}`
    writeFileSync(tempPath, JSON.stringify(payload, null, 2))
    renameSync(tempPath, this.registryFile)
  }

  private async probeS6Service(item: ManagedService): Promise<void> {
    const { spec, state } = item
    if (spec.port) {
      const portOk = await probeTcpPort(spec.port, spec.healthCheck.timeoutMs || 1500)
      if (portOk) {
        const pid = await findPidByPort(spec.port)
        state.pid = pid ? (getInnerNsPid(pid) || pid) : null
        state.status = 'running'
        return
      }
    }
    if (spec.processPatterns.length > 0) {
      const pid = await findPidByPattern(spec.processPatterns[0])
      if (pid) {
        state.pid = getInnerNsPid(pid) || pid
        state.status = spec.port ? 'starting' : 'running'
        return
      }
    }
    state.pid = null
    state.status = state.status === 'failed' ? 'failed' : 'stopped'
  }

  private async probeManagedService(item: ManagedService): Promise<void> {
    const { spec, state } = item
    if (spec.adapter === 's6') {
      return this.probeS6Service(item)
    }
    if (!item.proc) {
      const persistedPid = this.readPidFile(spec.id)
      const adoptedPid = (spec.port ? await findPidByPort(spec.port) : null)
        || (spec.processPatterns.length > 0 ? await findPidByPattern(spec.processPatterns[0]) : null)
      const effectivePid = persistedPid || adoptedPid
      if (effectivePid) {
        const portOk = spec.port ? await probeTcpPort(spec.port, spec.healthCheck.timeoutMs || 1500) : true
        state.pid = getInnerNsPid(effectivePid) || effectivePid
        state.status = portOk ? 'running' : 'starting'
        return
      }
      state.pid = null
      state.status = state.status === 'failed' ? 'failed' : 'stopped'
      return
    }
    if (spec.port) {
      const healthy = await probeTcpPort(spec.port, spec.healthCheck.timeoutMs || 1500)
      state.status = healthy ? 'running' : (state.status === 'starting' ? 'starting' : 'running')
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.started) return
    const specs = this.loadRegistryFromDisk()
    this.services.clear()
    for (const spec of specs) {
      this.services.set(spec.id, this.hydrateManagedService(spec))
    }
    this.persistRegistry()
    this.started = true
  }

  private buildServiceEnv(spec: RegisteredServiceSpec): Record<string, string> {
    const env: Record<string, string> = {}
    for (const key of spec.envVarKeys) {
      if (process.env[key]) env[key] = process.env[key] as string
    }
    if (spec.port) env.PORT = String(spec.port)
    env.HOST = '0.0.0.0'
    env.NODE_OPTIONS = buildNodeOptions()
    return env
  }

  private async captureProcessOutput(
    id: string,
    proc: ReturnType<typeof Bun.spawn>,
  ): Promise<void> {
    const readStream = async (stream: ReadableStream<Uint8Array> | null, prefix: string) => {
      if (!stream) return
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value, { stream: true })
          for (const line of text.split('\n')) {
            if (line.trim()) this.appendLog(id, `[${prefix}] ${line}`)
          }
        }
      } catch {
        // ignore closed stream
      }
    }

    void readStream(proc.stdout as ReadableStream<Uint8Array> | null, 'stdout')
    void readStream(proc.stderr as ReadableStream<Uint8Array> | null, 'stderr')
  }

  private async startSpawnService(item: ManagedService): Promise<ServiceActionResult> {
    const { spec, state } = item
    if (!spec.startCommand) return { ok: false, output: `Missing start command for ${spec.id}` }
    if (item.proc && state.status !== 'stopped' && state.status !== 'failed') {
      return { ok: true, output: 'already running', service: { ...state } }
    }

    if (spec.port && await probeTcpPort(spec.port, spec.healthCheck.timeoutMs || 1500)) {
      const persistedPid = this.readPidFile(spec.id)
      const adoptedPid = await findPidByPort(spec.port)
        || (spec.processPatterns.length > 0 ? await findPidByPattern(spec.processPatterns[0]) : null)
      state.status = 'running'
      state.port = spec.port
      state.pid = persistedPid || (adoptedPid ? (getInnerNsPid(adoptedPid) || adoptedPid) : null)
      state.startedAt = state.startedAt || nowIso()
      return { ok: true, output: 'already bound', service: { ...state } }
    }

    const cwd = resolveSourcePath(spec.sourcePath)
    if (!existsSync(cwd)) {
      state.status = 'failed'
      state.lastError = `Source path not found: ${cwd}`
      state.stoppedAt = nowIso()
      return { ok: false, output: state.lastError, service: { ...state } }
    }

    state.status = 'starting'
    state.lastError = null
    state.stoppedAt = null

    let proc: ReturnType<typeof Bun.spawn>
    try {
      proc = Bun.spawn(['/bin/sh', '-c', spec.startCommand], {
        cwd,
        env: {
          ...process.env as Record<string, string>,
          ...this.buildServiceEnv(spec),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      })
    } catch (err) {
      state.status = 'failed'
      state.lastError = String(err)
      state.stoppedAt = nowIso()
      return { ok: false, output: state.lastError, service: { ...state } }
    }

    item.proc = proc
    item.intentionallyStopped = false
    state.pid = proc.pid
    this.writePidFile(spec.id, proc.pid)
    state.startedAt = nowIso()
    state.port = spec.port ?? null
    this.appendLog(spec.id, `[manager] starting ${spec.startCommand}`)
    void this.captureProcessOutput(spec.id, proc)

    void proc.exited.then(async (exitCode) => {
      if (item.proc !== proc) return
      item.proc = null
      state.pid = null
      this.writePidFile(spec.id, null)
      state.stoppedAt = nowIso()
      if (item.intentionallyStopped || item.spec.desiredState === 'stopped') {
        state.status = 'stopped'
        return
      }
      state.status = 'failed'
      state.lastError = `Exited with code ${exitCode}`
      this.appendLog(spec.id, `[manager] exited with code ${exitCode}`)
      if (item.spec.restartPolicy === 'never') return
      if (item.spec.restartPolicy === 'on-failure' && exitCode === 0) return
      state.restarts += 1
      state.status = 'backoff'
      const delay = item.spec.restartDelayMs || 1500
      this.appendLog(spec.id, `[manager] restarting in ${delay}ms`)
      setTimeout(() => {
        if (item.spec.desiredState !== 'running') return
        void this.startSpawnService(item)
      }, delay)
    })

    if (spec.port) {
      const ready = await waitForPort(spec.port, START_WAIT_MS)
      if (!ready) {
        state.status = 'failed'
        state.lastError = `Service did not bind port ${spec.port} within ${START_WAIT_MS / 1000}s`
        try { proc.kill() } catch {}
        return { ok: false, output: state.lastError, service: { ...state } }
      }
    }

    state.status = 'running'
    return { ok: true, output: 'running', service: { ...state } }
  }

  private async stopSpawnService(item: ManagedService): Promise<ServiceActionResult> {
    const { spec, state } = item
    if (!item.proc) {
      const persistedPid = this.readPidFile(spec.id)
      const adoptedPid = persistedPid
        || (spec.port ? await findPidByPort(spec.port) : null)
        || (spec.processPatterns.length > 0 ? await findPidByPattern(spec.processPatterns[0]) : null)
      if (adoptedPid) {
        const innerPid = getInnerNsPid(adoptedPid) || adoptedPid
        try { process.kill(innerPid, 'SIGTERM') } catch {}
        await Bun.sleep(500)
        if (spec.port) {
          const closed = await waitForPortToClose(spec.port, 3000).catch(() => false)
          if (!closed) {
            try { process.kill(innerPid, 'SIGKILL') } catch {}
            await waitForPortToClose(spec.port, 3000).catch(() => {})
          }
        }
      }
      state.status = 'stopped'
      state.pid = null
      this.writePidFile(spec.id, null)
      state.stoppedAt = nowIso()
      return { ok: true, output: 'already stopped', service: { ...state } }
    }

    item.intentionallyStopped = true
    const proc = item.proc
    try { proc.kill('SIGTERM') } catch {}

    const exited = await Promise.race([
      proc.exited.then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 5000)),
    ])

    if (!exited) {
      try { proc.kill('SIGKILL') } catch {}
    }

    item.proc = null
    state.status = 'stopped'
    state.pid = null
    this.writePidFile(spec.id, null)
    state.stoppedAt = nowIso()
    if (spec.port) await waitForPortToClose(spec.port, 5000).catch(() => {})
    return { ok: true, output: exited ? 'stopped' : 'killed', service: { ...state } }
  }

  private async startS6Service(item: ManagedService): Promise<ServiceActionResult> {
    const spec = item.spec
    if (!spec.s6ServiceName) return { ok: false, output: `No s6ServiceName for ${spec.id}` }
    try { Bun.spawnSync(['/usr/bin/s6-svc', '-u', `/run/service/${spec.s6ServiceName}`]) } catch {}
    await Bun.sleep(1000)
    await this.probeS6Service(item)
    return { ok: true, output: item.state.status === 'running' ? 'running' : 'starting', service: { ...item.state } }
  }

  private async stopS6Service(item: ManagedService): Promise<ServiceActionResult> {
    const spec = item.spec
    if (!spec.s6ServiceName) return { ok: false, output: `No s6ServiceName for ${spec.id}` }
    try { Bun.spawnSync(['/usr/bin/s6-svc', '-d', `/run/service/${spec.s6ServiceName}`]) } catch {}
    if (spec.port) await waitForPortToClose(spec.port, 5000).catch(() => {})
    item.state.status = 'stopped'
    item.state.pid = null
    item.state.stoppedAt = nowIso()
    return { ok: true, output: 'stopped', service: { ...item.state } }
  }

  private async restartS6Service(item: ManagedService): Promise<ServiceActionResult> {
    const spec = item.spec
    if (!spec.s6ServiceName) return { ok: false, output: `No s6ServiceName for ${spec.id}` }
    try { Bun.spawnSync(['/usr/bin/s6-svc', '-r', `/run/service/${spec.s6ServiceName}`]) } catch {}
    if (spec.port) {
      await waitForPortToClose(spec.port, 3000).catch(() => {})
      await waitForPort(spec.port, START_WAIT_MS).catch(() => {})
    } else {
      await Bun.sleep(1000)
    }
    await this.probeS6Service(item)
    return { ok: true, output: 'restarted', service: { ...item.state } }
  }

  private async cleanupLegacyOrphans(): Promise<void> {
    const patterns = [
      '/usr/local/bin/opencode serve --port 4096 --hostname 0.0.0.0',
      'bash /ephemeral/master/scripts/run-opencode-serve.sh',
      '/tmp/static-web-server.js',
    ]
    for (const pattern of patterns) {
      await runShell(`pkill -f ${JSON.stringify(pattern)}`, WORKSPACE_ROOT, undefined, 10_000).catch(() => {})
    }
  }

  async start(): Promise<void> {
    await this.ensureInitialized()
    await this.cleanupLegacyOrphans()
    await this.reconcile()
  }

  async stop(): Promise<void> {
    await this.ensureInitialized()
    const ids = [...this.services.keys()].reverse()
    for (const id of ids) {
      const item = this.services.get(id)
      if (!item) continue
      if (item.spec.adapter === 'spawn') {
        await this.stopSpawnService(item)
      }
    }
  }

  async syncStatuses(): Promise<void> {
    await this.ensureInitialized()
    for (const item of this.services.values()) {
      await this.probeManagedService(item)
    }
  }

  private buildServiceSnapshot(item: ManagedService): ServiceStateSnapshot {
    return {
      ...item.state,
      desiredState: item.spec.desiredState,
      builtin: item.spec.builtin,
      userVisible: item.spec.userVisible,
      port: item.spec.port ?? null,
      framework: item.spec.framework ?? null,
      sourcePath: item.spec.sourcePath ?? null,
      projectId: item.spec.projectId ?? null,
      template: item.spec.template ?? null,
      autoStart: item.spec.autoStart,
    }
  }

  async listServices(options?: { includeSystem?: boolean; includeStopped?: boolean }): Promise<ServiceStateSnapshot[]> {
    await this.ensureInitialized()
    await this.syncStatuses()
    const includeSystem = options?.includeSystem ?? false
    const includeStopped = options?.includeStopped ?? false
    return [...this.services.values()]
      .map((item) => this.buildServiceSnapshot(item))
      .filter((service) => includeSystem || service.userVisible)
      .filter((service) => includeStopped || service.status === 'running' || service.status === 'starting' || service.status === 'backoff')
  }

  async getService(id: string): Promise<ServiceStateSnapshot | null> {
    await this.ensureInitialized()
    const item = this.services.get(id)
    if (!item) return null
    await this.probeManagedService(item)
    return this.buildServiceSnapshot(item)
  }

  async getCoreStatus(): Promise<{ running: boolean; services: ServiceStateSnapshot[] }> {
    await this.ensureInitialized()
    await this.syncStatuses()
    const services = [...this.services.values()]
      .filter((item) => item.spec.scope === 'core' || item.spec.scope === 'bootstrap')
      .map((item) => this.buildServiceSnapshot(item))
    return {
      running: this.started,
      services,
    }
  }

  async registerService(input: RegisterServiceInput): Promise<ServiceStateSnapshot> {
    await this.ensureInitialized()
    const existing = this.services.get(input.id)
    const now = nowIso()

    if (existing?.spec.builtin) {
      const next = cloneServiceSpec(existing.spec)
      if (input.desiredState) next.desiredState = input.desiredState
      if (input.autoStart !== undefined) next.autoStart = input.autoStart
      next.updatedAt = now
      existing.spec = next
      existing.state = this.buildServiceSnapshot(existing)
      this.persistRegistry()
      return this.buildServiceSnapshot(existing)
    }

    const adapter: ServiceAdapter = 'spawn'
    const next: RegisteredServiceSpec = {
      id: input.id,
      name: input.name || existing?.spec.name || input.id,
      adapter,
      scope: input.scope || existing?.spec.scope || 'project',
      description: input.description || existing?.spec.description || '',
      builtin: false,
      userVisible: input.userVisible ?? existing?.spec.userVisible ?? true,
      projectId: input.projectId ?? existing?.spec.projectId ?? null,
      template: input.template ?? existing?.spec.template ?? 'custom-command',
      framework: input.framework ?? existing?.spec.framework ?? null,
      sourcePath: resolveSourcePath(input.sourcePath ?? existing?.spec.sourcePath ?? WORKSPACE_ROOT),
      sourceType: existing?.spec.sourceType || 'files',
      sourceRef: existing?.spec.sourceRef || null,
      startCommand: input.startCommand ?? existing?.spec.startCommand ?? null,
      installCommand: input.installCommand ?? existing?.spec.installCommand ?? null,
      buildCommand: input.buildCommand ?? existing?.spec.buildCommand ?? null,
      envVarKeys: [...new Set(input.envVarKeys ?? existing?.spec.envVarKeys ?? [])],
      deps: [...new Set(input.deps ?? existing?.spec.deps ?? [])],
      port: input.port ?? existing?.spec.port ?? null,
      desiredState: input.desiredState ?? existing?.spec.desiredState ?? 'running',
      autoStart: input.autoStart ?? existing?.spec.autoStart ?? true,
      restartPolicy: input.restartPolicy ?? existing?.spec.restartPolicy ?? 'always',
      restartDelayMs: input.restartDelayMs ?? existing?.spec.restartDelayMs ?? 1500,
      s6ServiceName: input.s6ServiceName ?? existing?.spec.s6ServiceName ?? null,
      processPatterns: [...new Set(input.processPatterns ?? existing?.spec.processPatterns ?? [])],
      healthCheck: {
        type: input.healthCheck?.type || existing?.spec.healthCheck.type || 'none',
        path: input.healthCheck?.path ?? existing?.spec.healthCheck.path,
        timeoutMs: input.healthCheck?.timeoutMs ?? existing?.spec.healthCheck.timeoutMs ?? 2000,
      },
      createdAt: existing?.spec.createdAt || now,
      updatedAt: now,
    }

    if (!next.startCommand) {
      throw new Error(`Service ${next.id} requires a startCommand`)
    }

    if (existing) {
      existing.spec = next
      existing.state = {
        ...existing.state,
        name: next.name,
        adapter: next.adapter,
        scope: next.scope,
        port: next.port ?? null,
        framework: next.framework ?? null,
        sourcePath: next.sourcePath ?? null,
        projectId: next.projectId ?? null,
        template: next.template ?? null,
        desiredState: next.desiredState,
        autoStart: next.autoStart,
        userVisible: next.userVisible,
      }
    } else {
      this.services.set(next.id, this.hydrateManagedService(next))
    }

    this.persistRegistry()
    return this.buildServiceSnapshot(this.services.get(next.id)!)
  }

  async unregisterService(id: string): Promise<ServiceActionResult> {
    await this.ensureInitialized()
    const item = this.services.get(id)
    if (!item) return { ok: false, output: `Unknown service: ${id}` }
    if (item.spec.builtin) return { ok: false, output: `Cannot unregister builtin service: ${id}` }
    await this.stopService(id)
    this.services.delete(id)
    this.persistRegistry()
    try { rmSync(this.logFilePath(id), { force: true }) } catch {}
    return { ok: true, output: `Removed ${id}` }
  }

  async startService(id: string): Promise<ServiceActionResult> {
    await this.ensureInitialized()
    const item = this.services.get(id)
    if (!item) return { ok: false, output: `Unknown service: ${id}` }

    for (const depId of item.spec.deps) {
      const dep = this.services.get(depId)
      if (!dep) return { ok: false, output: `Dependency not found: ${depId}` }
      await this.probeManagedService(dep)
      if (dep.state.status !== 'running') {
        return { ok: false, output: `Dependency not running: ${depId}` }
      }
    }

    item.spec.desiredState = 'running'
    item.spec.updatedAt = nowIso()
    this.persistRegistry()

    const result = item.spec.adapter === 's6'
      ? await this.startS6Service(item)
      : await this.startSpawnService(item)
    return { ...result, service: this.buildServiceSnapshot(item) }
  }

  async stopService(id: string, options?: { persistDesiredState?: boolean }): Promise<ServiceActionResult> {
    await this.ensureInitialized()
    const item = this.services.get(id)
    if (!item) return { ok: false, output: `Unknown service: ${id}` }

    if ((options?.persistDesiredState ?? true) === true) {
      item.spec.desiredState = 'stopped'
      item.spec.updatedAt = nowIso()
      this.persistRegistry()
    }

    const result = item.spec.adapter === 's6'
      ? await this.stopS6Service(item)
      : await this.stopSpawnService(item)
    return { ...result, service: this.buildServiceSnapshot(item) }
  }

  async restartService(id: string): Promise<ServiceActionResult> {
    await this.ensureInitialized()
    const item = this.services.get(id)
    if (!item) return { ok: false, output: `Unknown service: ${id}` }

    if (item.spec.adapter === 's6') return this.restartS6Service(item)
    await this.stopSpawnService(item)
    return this.startService(id)
  }

  async reconcile(): Promise<ServiceActionResult> {
    await this.ensureInitialized()
    const ordered = sortServices([...this.services.values()].map(({ spec }) => spec))
    for (const spec of ordered) {
      const item = this.services.get(spec.id)!
      if (!spec.autoStart && spec.desiredState !== 'running') {
        await this.probeManagedService(item)
        continue
      }
      if (spec.desiredState === 'running') {
        if (spec.adapter === 's6') {
          await this.probeManagedService(item)
          continue
        }
        if (item.proc) {
          await this.probeManagedService(item)
          continue
        }
        await this.startSpawnService(item)
      } else {
        if (spec.adapter === 'spawn' && item.proc) {
          await this.stopSpawnService(item)
        }
      }
    }
    this.persistRegistry()
    return { ok: true, output: `Reconciled ${this.services.size} services` }
  }

  async reloadFromDiskAndReconcile(): Promise<ServiceActionResult> {
    const currentProcesses = [...this.services.values()].filter((item) => item.proc)
    for (const item of currentProcesses) {
      await this.stopSpawnService(item)
    }
    this.started = false
    await this.ensureInitialized()
    return this.reconcile()
  }

  async prepareForFullReload(): Promise<{ stopped: string[] }> {
    await this.ensureInitialized()
    const ordered = sortServices([...this.services.values()].map(({ spec }) => spec)).reverse()
    const stopped: string[] = []

    for (const spec of ordered) {
      const item = this.services.get(spec.id)
      if (!item) continue
      await this.stopService(spec.id, { persistDesiredState: false })
      stopped.push(spec.id)
    }

    return { stopped }
  }

  async getLogs(id: string, limit: number = 500): Promise<{ logs: string[]; error?: string }> {
    await this.ensureInitialized()
    const item = this.services.get(id)
    if (!item) return { logs: [], error: `Service not found: ${id}` }
    const logPath = this.logFilePath(id)
    if (!existsSync(logPath)) return { logs: [] }
    const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)
    return { logs: lines.slice(-limit) }
  }

  listTemplates(): ServiceTemplate[] {
    return SERVICE_TEMPLATES.map((template) => ({ ...template }))
  }

  async deployLegacyService(config: LegacyDeploymentConfig): Promise<DeployResult> {
    await this.ensureInitialized()
    const logs: string[] = []
    const pushLog = (message: string) => {
      logs.push(message)
    }

    try {
      const sourcePath = resolveSourcePath(config.sourcePath || WORKSPACE_ROOT)
      if (!existsSync(sourcePath) && config.sourceType !== 'git') {
        return { success: false, error: `Source path not found: ${sourcePath}`, framework: 'unknown', logs }
      }

      if (config.sourceType === 'git' && config.sourceRef) {
        if (existsSync(join(sourcePath, '.git'))) {
          const pull = await runShell('git pull', sourcePath, undefined, 60_000)
          pushLog(pull.output)
          if (!pull.ok) {
            return { success: false, error: 'Git pull failed', framework: 'unknown', logs }
          }
        } else {
          mkdirSync(sourcePath, { recursive: true })
          const clone = await runShell(`git clone ${config.sourceRef} .`, sourcePath, undefined, 120_000)
          pushLog(clone.output)
          if (!clone.ok) {
            return { success: false, error: 'Git clone failed', framework: 'unknown', logs }
          }
        }
      }

      const framework = config.framework || detectFramework(sourcePath)
      const cmds = getFrameworkCommands(framework, sourcePath, config.entrypoint)

      const env: Record<string, string> = {}
      for (const key of (config.envVarKeys || [])) {
        if (process.env[key]) env[key] = process.env[key] as string
      }

      let buildDuration: number | undefined
      if (cmds.install && shouldRunInstall(cmds.install, sourcePath)) {
        const started = Date.now()
        const install = await runShell(cmds.install, sourcePath, env, INSTALL_TIMEOUT_MS)
        buildDuration = Date.now() - started
        pushLog(install.output)
        if (!install.ok) {
          return { success: false, error: `Install failed (${Math.round(buildDuration / 1000)}s)`, framework, logs, buildDuration }
        }
      }

      if (cmds.build) {
        const started = Date.now()
        const build = await runShell(cmds.build, sourcePath, env, BUILD_TIMEOUT_MS)
        buildDuration = Date.now() - started
        pushLog(build.output)
        if (!build.ok) {
          return { success: false, error: `Build failed (${Math.round(buildDuration / 1000)}s)`, framework, logs, buildDuration }
        }
      }

      const existing = this.services.get(config.deploymentId)
      const port = existing?.spec.port || await findAvailablePort()

      const startCommand = cmds.start.replace(/__PORT__/g, String(port))
      const processPattern = (config.entrypoint || startCommand).split(/\s+/).filter(Boolean).pop() || startCommand

      await this.registerService({
        id: config.deploymentId,
        name: config.deploymentId,
        adapter: 'spawn',
        scope: 'project',
        template: framework,
        framework,
        sourcePath,
        startCommand,
        installCommand: cmds.install,
        buildCommand: cmds.build,
        envVarKeys: config.envVarKeys || [],
        processPatterns: [processPattern],
        port,
        desiredState: 'running',
        autoStart: true,
        restartPolicy: 'always',
        restartDelayMs: 1500,
        userVisible: true,
        healthCheck: { type: 'tcp', timeoutMs: 2000 },
      })

      const startTime = Date.now()
      const started = await this.restartService(config.deploymentId)
      const startDuration = Date.now() - startTime
      if (!started.ok || !started.service) {
        return {
          success: false,
          error: started.output,
          framework,
          logs,
          buildDuration,
          startDuration,
        }
      }

      return {
        success: true,
        service: started.service,
        port: started.service.port || undefined,
        pid: started.service.pid || undefined,
        framework,
        logs,
        buildDuration,
        startDuration,
      }
    } catch (err) {
      return {
        success: false,
        error: String(err),
        framework: config.framework || 'unknown',
        logs,
      }
    }
  }
}

export const serviceManager = new ServiceManager()
