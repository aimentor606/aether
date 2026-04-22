import { config, SANDBOX_VERSION } from '../config';
import { litellmConfig } from '../router/config/litellm-config';
import { resolveVirtualKey } from '../router/services/litellm-keys';
import type { PoolSandbox } from './types';

function buildAetherMasterUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return `${parsed.protocol}//8000--${parsed.hostname}/env`;
}

function buildToolboxUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);
  return `${parsed.protocol}//${parsed.hostname}/toolbox/process/execute`;
}

function buildHeaders(metadata: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const proxyToken = metadata.justavpsProxyToken as string | undefined;
  if (proxyToken) headers['X-Proxy-Token'] = proxyToken;

  const placeholderToken = metadata.poolPlaceholderToken as string | undefined;
  if (placeholderToken) headers['Authorization'] = `Bearer ${placeholderToken}`;

  return headers;
}

function buildEnvPayload(
  serviceKey: string,
  metadata?: Record<string, unknown>,
  litellmKey?: string,
): Record<string, string> {
  const sandboxApiBase = config.AETHER_URL.replace(/\/v1\/router\/?$/, '');

  const payload: Record<string, string> = {
    AETHER_API_URL: sandboxApiBase,
    ENV_MODE: 'cloud',
    INTERNAL_SERVICE_KEY: serviceKey,
    AETHER_TOKEN: serviceKey,
    AETHER_SANDBOX_VERSION: SANDBOX_VERSION,

    // Direct upstream URLs (sandbox calls tool services directly, no proxy)
    TAVILY_API_URL: 'https://api.tavily.com',
    SERPER_API_URL: 'https://google.serper.dev',
    FIRECRAWL_API_URL: 'https://api.firecrawl.dev',
    REPLICATE_API_URL: 'https://api.replicate.com',

    // Direct API keys (replaces proxy-based key injection)
    ...(config.TAVILY_API_KEY ? { TAVILY_API_KEY: config.TAVILY_API_KEY } : {}),
    ...(config.SERPER_API_KEY ? { SERPER_API_KEY: config.SERPER_API_KEY } : {}),
    ...(config.FIRECRAWL_API_KEY ? { FIRECRAWL_API_KEY: config.FIRECRAWL_API_KEY } : {}),
    ...(config.REPLICATE_API_TOKEN ? { REPLICATE_API_TOKEN: config.REPLICATE_API_TOKEN } : {}),

    // LiteLLM credentials (data plane direct connect)
    LITELLM_BASE_URL: litellmConfig.LITELLM_PUBLIC_URL,
    ...(litellmKey ? { LITELLM_API_KEY: litellmKey } : {}),

    TUNNEL_API_URL: sandboxApiBase,
    TUNNEL_TOKEN: serviceKey,
  };

  if (metadata) {
    const slug = metadata.justavpsSlug as string | undefined;
    const proxyToken = metadata.justavpsProxyToken as string | undefined;
    const proxyDomain = config.JUSTAVPS_PROXY_DOMAIN || 'aether.cloud';
    if (slug && proxyToken) {
      payload.PUBLIC_BASE_URL = `https://8000--${slug}.${proxyDomain}?__proxy_token=${proxyToken}`;
    }
  }

  return payload;
}

/**
 * Inject environment variables into a pool sandbox.
 * 1. POST to the running container's /env endpoint (immediate effect).
 * 2. Update /etc/justavps/env on the host via toolbox (persists across restarts).
 * Throws on failure so callers can handle broken sandboxes.
 */
export async function inject(poolSandbox: PoolSandbox, serviceKey: string, accountId?: string): Promise<void> {
  const meta = (poolSandbox.metadata as Record<string, unknown>) ?? {};
  const url = buildAetherMasterUrl(poolSandbox.baseUrl);
  const headers = buildHeaders(meta);

  let litellmKey: string | undefined;
  if (accountId) {
    try {
      litellmKey = await resolveVirtualKey(accountId);
    } catch (err) {
      console.warn(`[POOL] Failed to resolve LiteLLM key for ${accountId}:`, err);
    }
  }

  const keys = buildEnvPayload(serviceKey, meta, litellmKey);

  // Step 1: Inject into the running container
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ keys }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Env injection failed (${res.status}) for ${poolSandbox.externalId}: ${text.slice(0, 300)}`);
  }

  console.log(`[POOL] Env injected into container ${poolSandbox.externalId}`);

  // Step 2: Persist to host env file so restarts preserve the real token.
  // The host env file (/etc/justavps/env) is read by docker run --env-file.
  // Without this, a container restart reverts to the pool placeholder token.
  try {
    const toolboxUrl = buildToolboxUrl(poolSandbox.baseUrl);
    const toolboxHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    const proxyToken = meta.justavpsProxyToken as string | undefined;
    if (proxyToken) toolboxHeaders['X-Proxy-Token'] = proxyToken;

    // Build the env file content: preserve existing lines, override/add our keys
    const envLines = Object.entries(keys)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // Use a script that merges our vars into /etc/justavps/env without losing other vars
    const command = [
      'ENV_FILE="/etc/justavps/env"',
      'TEMP_FILE="$(mktemp)"',
      // Copy existing env, removing keys we're about to set
      ...Object.keys(keys).map((k) => `grep -v "^${k}=" "$ENV_FILE" > "$TEMP_FILE" 2>/dev/null; mv "$TEMP_FILE" "$ENV_FILE"`),
      // Append our keys
      `cat >> "$ENV_FILE" << 'ENVEOF'\n${envLines}\nENVEOF`,
    ].join('\n');

    const toolboxRes = await fetch(toolboxUrl, {
      method: 'POST',
      headers: toolboxHeaders,
      body: JSON.stringify({ command, timeout: 10 }),
      signal: AbortSignal.timeout(15_000),
    });

    if (toolboxRes.ok) {
      console.log(`[POOL] Host env file updated for ${poolSandbox.externalId}`);
    } else {
      const text = await toolboxRes.text().catch(() => '');
      console.warn(`[POOL] Host env file update failed (${toolboxRes.status}) for ${poolSandbox.externalId}: ${text.slice(0, 200)}`);
    }
  } catch (err) {
    // Non-fatal: container already has the right env, just won't survive a restart
    console.warn(`[POOL] Host env file update failed for ${poolSandbox.externalId}:`, err);
  }
}
