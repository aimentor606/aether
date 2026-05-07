import { config } from '../../config';

// ─── Master URL Resolution ──────────────────────────────────────────────────

function getMasterUrlCandidates(): string[] {
  const candidates: string[] = [];
  const explicit = process.env.AETHER_MASTER_URL;
  if (explicit && explicit.trim()) candidates.push(explicit.trim());
  candidates.push('http://sandbox:8000');
  candidates.push(`http://localhost:${config.SANDBOX_PORT_BASE || 14000}`);
  return Array.from(new Set(candidates));
}

// ─── HTTP Helpers ───────────────────────────────────────────────────────────

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMasterJson<T>(path: string, init: RequestInit = {}, timeoutMs = 5000): Promise<T> {
  const candidates = getMasterUrlCandidates();
  let lastErr: unknown = null;
  const serviceKey = process.env.INTERNAL_SERVICE_KEY;
  if (serviceKey) {
    const existingHeaders = init.headers ? Object.fromEntries(new Headers(init.headers as HeadersInit).entries()) : {};
    init = { ...init, headers: { ...existingHeaders, Authorization: `Bearer ${serviceKey}` } };
  }
  for (const base of candidates) {
    const url = `${base}${path}`;
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      // 503 from /kortix/health means "starting" — still return the JSON body
      // so callers can inspect the status/opencode fields.
      if (!res.ok && res.status !== 503) { lastErr = new Error(`Master ${url} returned ${res.status}`); continue; }
      return (await res.json()) as T;
    } catch (e) { lastErr = e; continue; }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Failed to reach sandbox master');
}

export async function getSandboxEnv(): Promise<Record<string, string>> {
  try { return await fetchMasterJson<Record<string, string>>('/env'); }
  catch { return {}; }
}

export async function setSandboxEnv(keys: Record<string, string>): Promise<void> {
  await fetchMasterJson('/env', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  }, 15000);
}
