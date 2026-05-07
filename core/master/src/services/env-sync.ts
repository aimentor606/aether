/**
 * env-sync — Unified facade for writing environment variables across all stores.
 *
 * Every env var change must reach 4 stores:
 *   1. SecretStore   (encrypted file + process.env)
 *   2. s6 env dir    (child processes read via with-contenv)
 *   3. auth.json     (OpenCode provider keys, if applicable)
 *   4. bootstrap-env.json (core identity vars, if applicable)
 *
 * Callers should use this instead of calling each store individually.
 */

import { mkdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import type { SecretStore } from './secret-store'
import { syncSecretToAuth } from './auth-sync'
import { updateBootstrapKey } from './bootstrap-env'

const S6_ENV_DIR = process.env.S6_ENV_DIR || '/run/s6/container_environment'

export class EnvSync {
  constructor(private store: SecretStore) {}

  async get(key: string): Promise<string | null> {
    return this.store.get(key)
  }

  async getAll(): Promise<Record<string, string>> {
    return this.store.getAll()
  }

  /**
   * Set a key across all stores. Fans out to:
   *   SecretStore → s6 env dir → auth.json → bootstrap-env.json
   */
  async set(key: string, value: string): Promise<void> {
    await this.store.setEnv(key, value)
    await this.writeS6(key, value)
    await syncSecretToAuth(key, value)
    updateBootstrapKey(key, value)
  }

  /**
   * Delete a key from all stores. Fans out to:
   *   SecretStore → s6 env dir → auth.json
   */
  async delete(key: string): Promise<void> {
    await this.store.deleteEnv(key)
    await this.deleteS6(key)
    await syncSecretToAuth(key, '')
  }

  /**
   * Rotate AETHER_TOKEN. Only updates s6 + bootstrap (SecretStore handles its own rotation).
   */
  async rotateToken(newToken: string): Promise<{ rotated: number }> {
    const result = await this.store.rotateToken(newToken)
    await this.writeS6('AETHER_TOKEN', newToken)
    updateBootstrapKey('AETHER_TOKEN', newToken)
    return result
  }

  private async writeS6(key: string, value: string): Promise<void> {
    if (!existsSync(S6_ENV_DIR)) {
      await mkdir(S6_ENV_DIR, { recursive: true })
    }
    await Bun.write(`${S6_ENV_DIR}/${key}`, value)
  }

  private async deleteS6(key: string): Promise<void> {
    try { await rm(`${S6_ENV_DIR}/${key}`) } catch {}
  }
}
