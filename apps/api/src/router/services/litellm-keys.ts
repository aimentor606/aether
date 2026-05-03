import { litellmConfig } from '../config/litellm-config';
import { logger } from '../../lib/logger';

interface CachedKey {
  key: string;
  expiresAt: number;
}

interface LiteLLMKeyInfoResponse {
  key?: string;
  token?: string;
  info?: {
    key?: string;
    token?: string;
  };
  data?: {
    key?: string;
    token?: string;
  };
}

const KEY_CACHE_TTL_MS = 5 * 60 * 1000;
const keyCache = new Map<string, CachedKey>();

function getAlias(accountId: string): string {
  return `aether-${accountId}`;
}

function getCachedKey(accountId: string): string | null {
  const entry = keyCache.get(accountId);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    keyCache.delete(accountId);
    return null;
  }
  return entry.key;
}

function setCachedKey(accountId: string, key: string): void {
  keyCache.set(accountId, {
    key,
    expiresAt: Date.now() + KEY_CACHE_TTL_MS,
  });
}

function extractKeyFromInfoResponse(payload: LiteLLMKeyInfoResponse): string | null {
  return payload.key ?? payload.token ?? payload.info?.key ?? payload.info?.token ?? payload.data?.key ?? payload.data?.token ?? null;
}

export async function resolveVirtualKey(accountId: string): Promise<string> {
  const cached = getCachedKey(accountId);
  if (cached) {
    return cached;
  }

  const existing = await findKeyByAlias(accountId);
  if (existing?.key) {
    setCachedKey(accountId, existing.key);
    return existing.key;
  }

  const created = await createVirtualKey(accountId);
  setCachedKey(accountId, created);
  return created;
}

export async function syncKeyBudget(accountId: string, budgetUsd: number): Promise<void> {
  const key = await resolveVirtualKey(accountId);

  const response = await fetch(`${litellmConfig.LITELLM_URL}/key/update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify({
      key,
      max_budget: budgetUsd,
      budget_duration: '1mo',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[LiteLLM] Failed to sync key budget for ${accountId}: ${response.status} ${errorBody}`);
  }
}

async function createVirtualKey(accountId: string): Promise<string> {
  const alias = getAlias(accountId);

  const response = await fetch(`${litellmConfig.LITELLM_URL}/key/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify({
      key_alias: alias,
      user_id: accountId,
      budget_duration: '1mo',
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[LiteLLM] Failed to create virtual key for ${accountId}: ${response.status} ${errorBody}`);
  }

  const payload = (await response.json()) as LiteLLMKeyInfoResponse;
  const key = extractKeyFromInfoResponse(payload);
  if (!key) {
    throw new Error(`[LiteLLM] LiteLLM key generation response missing key for ${accountId}`);
  }

  return key;
}

async function findKeyByAlias(accountId: string): Promise<{ key: string } | null> {
  const alias = getAlias(accountId);
  const url = `${litellmConfig.LITELLM_URL}/key/info?key_alias=${encodeURIComponent(alias)}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`[LiteLLM] Failed to find key for ${accountId}: ${response.status} ${errorBody}`);
  }

  const payload = (await response.json()) as LiteLLMKeyInfoResponse;
  const key = extractKeyFromInfoResponse(payload);
  if (!key) {
    return null;
  }

  return { key };
}

/**
 * Migrate existing virtual keys that lack user_id.
 * LiteLLM's OpenMeter callback uses user_id as the CloudEvent subject,
 * so keys created before this field was added need patching.
 */
export async function migrateExistingKeys(): Promise<void> {
  const response = await fetch(`${litellmConfig.LITELLM_URL}/key/list`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
    },
  });

  if (!response.ok) {
    logger.error(`[LiteLLM] key/list failed during migration: ${response.status}`);
    return;
  }

  const payload = (await response.json()) as {
    keys?: Array<{
      key_alias?: string;
      user_id?: string;
      key?: string;
      token?: string;
    }>;
  };

  const keys = payload.keys ?? [];
  const aetherKeys = keys.filter(
    (k) => k.key_alias?.startsWith('aether-') && !k.user_id,
  );

  for (const k of aetherKeys) {
    const accountId = k.key_alias!.replace('aether-', '');
    const keyToken = k.key ?? k.token;
    if (!keyToken) continue;

    try {
      const updateRes = await fetch(`${litellmConfig.LITELLM_URL}/key/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
        },
        body: JSON.stringify({ key: keyToken, user_id: accountId }),
      });

      if (updateRes.ok) {
        logger.info(`[LiteLLM] Migrated key ${k.key_alias} → user_id=${accountId}`);
      } else {
        logger.error(`[LiteLLM] Failed to migrate key ${k.key_alias}: ${updateRes.status}`);
      }
    } catch (err: unknown) {
      logger.error(`[LiteLLM] Error migrating key ${k.key_alias}`, err as Record<string, unknown>);
    }
  }

  if (aetherKeys.length > 0) {
    logger.info(`[LiteLLM] Key migration complete: ${aetherKeys.length} keys processed`);
  }
}
