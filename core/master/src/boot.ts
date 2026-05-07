import { existsSync, mkdirSync } from 'fs'
import { SecretStore } from './services/secret-store'
import { syncAuthToSecrets, startWatcher as startAuthWatcher } from './services/auth-sync'
import { serviceManager } from './services/service-manager'
import { loadBootstrapEnv, saveBootstrapEnv } from './services/bootstrap-env'

export interface BootResult {
  secretStore: SecretStore
}

export async function boot(): Promise<BootResult> {
  // ─── Crash protection ────────────────────────────────────────────────────
  process.on('uncaughtException', (err) => {
    console.error('[Aether] UNCAUGHT EXCEPTION:', err)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[Aether] UNHANDLED REJECTION:', reason)
  })

  // ─── Bootstrap: restore core env vars if missing from process.env ────────
  // Must run BEFORE SecretStore because AETHER_TOKEN is the encryption key.
  loadBootstrapEnv()

  const secretStore = new SecretStore()
  await secretStore.loadIntoProcessEnv()

  // Initialize share store (load persisted shares, start prune timer)
  const { initShareStore } = await import('./services/share-store')
  initShareStore()

  // ─── Guarantee AETHER_TOKEN + AETHER_API_URL in s6 env dir ──────────────
  {
    const S6_ENV_DIR = process.env.S6_ENV_DIR || '/run/s6/container_environment'
    const CORE_VARS = ['AETHER_TOKEN', 'AETHER_API_URL', 'INTERNAL_SERVICE_KEY'] as const
    let synced = 0
    for (const key of CORE_VARS) {
      let val: string | undefined = process.env[key]
      if (!val && key === 'AETHER_API_URL') {
        val = 'http://localhost:8008'
      }
      if (val) {
        try {
          if (!existsSync(S6_ENV_DIR)) mkdirSync(S6_ENV_DIR, { recursive: true })
          await Bun.write(`${S6_ENV_DIR}/${key}`, val)
          synced++
        } catch (err) {
          console.warn(`[Aether] Failed to write ${key} to s6 env dir:`, err)
        }
      }
    }
    if (synced > 0) {
      console.log(`[Aether] Synced ${synced} core env var(s) to s6 env dir`)
    }
    saveBootstrapEnv()
  }

  // ─── Auth sync ───────────────────────────────────────────────────────────
  const authSyncDisabled = process.env.AETHER_DISABLE_AUTH_SYNC === 'true'
  if (!authSyncDisabled) {
    await syncAuthToSecrets(secretStore).catch(err =>
      console.error('[Aether] auth-sync boot error:', err)
    )
    startAuthWatcher(secretStore)
  }

  // ─── Service manager ─────────────────────────────────────────────────────
  if (process.env.AETHER_DISABLE_CORE_SUPERVISOR !== 'true') {
    await serviceManager.start().catch(err =>
      console.error('[Aether] service manager start error:', err)
    )
  }

  return { secretStore }
}
