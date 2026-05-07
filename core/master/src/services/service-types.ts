export type ServiceAdapter = 'spawn' | 's6'
export type ServiceScope = 'bootstrap' | 'core' | 'project' | 'session'
export type ServiceStatus = 'starting' | 'running' | 'stopped' | 'failed' | 'backoff'
export type ServiceRestartPolicy = 'always' | 'on-failure' | 'never'
export type ServiceHealthType = 'none' | 'tcp' | 'http'

export interface ServiceHealthCheck {
  type: ServiceHealthType
  path?: string
  timeoutMs?: number
}

export interface RegisteredServiceSpec {
  id: string
  name: string
  adapter: ServiceAdapter
  scope: ServiceScope
  description?: string
  builtin: boolean
  userVisible: boolean
  projectId?: string | null
  template?: string | null
  framework?: string | null
  sourcePath?: string | null
  sourceType?: 'git' | 'code' | 'files' | 'tar'
  sourceRef?: string | null
  startCommand?: string | null
  installCommand?: string | null
  buildCommand?: string | null
  envVarKeys: string[]
  deps: string[]
  port?: number | null
  desiredState: 'running' | 'stopped'
  autoStart: boolean
  restartPolicy: ServiceRestartPolicy
  restartDelayMs: number
  s6ServiceName?: string | null
  processPatterns: string[]
  healthCheck: ServiceHealthCheck
  createdAt: string
  updatedAt: string
}

export interface ServiceStateSnapshot {
  id: string
  name: string
  adapter: ServiceAdapter
  scope: ServiceScope
  status: ServiceStatus
  desiredState: 'running' | 'stopped'
  builtin: boolean
  userVisible: boolean
  pid: number | null
  port: number | null
  framework: string | null
  sourcePath: string | null
  projectId: string | null
  template: string | null
  autoStart: boolean
  restarts: number
  startedAt: string | null
  stoppedAt: string | null
  lastError: string | null
  managed: true
}

export interface ManagedService {
  spec: RegisteredServiceSpec
  proc: Bun.Subprocess<any, any, any> | null
  state: ServiceStateSnapshot
  intentionallyStopped: boolean
}

export interface ServiceRegistryFile {
  version: number
  services: RegisteredServiceSpec[]
}

export interface FrameworkCommands {
  install: string | null
  build: string | null
  start: string
}

export interface LegacyDeploymentConfig {
  deploymentId: string
  sourceType: 'git' | 'code' | 'files' | 'tar'
  sourceRef?: string
  sourcePath: string
  framework?: string
  envVarKeys?: string[]
  buildConfig?: Record<string, string>
  entrypoint?: string
}

export interface DeployResult {
  success: boolean
  service?: ServiceStateSnapshot
  port?: number
  pid?: number
  framework: string
  logs: string[]
  error?: string
  buildDuration?: number
  startDuration?: number
}

export interface ServiceActionResult {
  ok: boolean
  output: string
  service?: ServiceStateSnapshot
}

export interface RegisterServiceInput {
  id: string
  name?: string
  adapter: ServiceAdapter
  scope: ServiceScope
  description?: string
  projectId?: string | null
  template?: string | null
  framework?: string | null
  sourcePath?: string | null
  sourceType?: 'git' | 'code' | 'files' | 'tar'
  sourceRef?: string | null
  startCommand?: string | null
  installCommand?: string | null
  buildCommand?: string | null
  envVarKeys?: string[]
  deps?: string[]
  port?: number | null
  desiredState: 'running' | 'stopped'
  autoStart?: boolean
  restartPolicy?: ServiceRestartPolicy
  restartDelayMs?: number
  s6ServiceName?: string | null
  processPatterns?: string[]
  healthCheck?: ServiceHealthCheck
  userVisible?: boolean
}

export interface ServiceTemplate {
  id: string
  name: string
  description: string
  framework: string
  startCommand: string
  installCommand: string | null
  buildCommand: string | null
  defaultPort: number
  adapter: ServiceAdapter
}
