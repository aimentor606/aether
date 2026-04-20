/**
 * Subdomain preview routing for local Docker sandboxes.
 * Pattern: p{port}-{sandboxId}.localhost:{serverPort}
 *
 * Once a subdomain is authenticated (via Bearer/cookie on first request),
 * all subsequent requests pass through without re-auth (like ngrok free tier).
 * This avoids third-party cookie issues in iframes (Chrome blocks them).
 */

import { isAetherToken } from '../shared/crypto';
import { validateSecretKey } from '../repositories/api-keys';
import { canAccessPreviewSandbox } from '../shared/preview-ownership';
import { verifySupabaseJwt } from '../shared/jwt-verify';
import { getSupabase } from '../shared/supabase';

const SUBDOMAIN_REGEX = /^p(\d+)-([^.]+)\.localhost/;
const PREVIEW_SESSION_COOKIE = '__preview_session';

export function parsePreviewSubdomain(host: string): { port: number; sandboxId: string } | null {
  const match = host.match(SUBDOMAIN_REGEX);
  if (!match) return null;
  const port = parseInt(match[1], 10);
  if (isNaN(port) || port < 1 || port > 65535) return null;
  return { port, sandboxId: match[2] };
}

export function extractCookieToken(req: Request): string | null {
  const cookieHeader = req.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${PREVIEW_SESSION_COOKIE}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function validatePreviewToken(token: string, sandboxId: string): Promise<boolean> {
  if (isAetherToken(token)) {
    const result = await validateSecretKey(token);
    return !!result.isValid && !!result.accountId && await canAccessPreviewSandbox({
      previewSandboxId: sandboxId,
      accountId: result.accountId,
    });
  }
  // Fast path: local JWT verification (no network roundtrip)
  const local = await verifySupabaseJwt(token);
  if (local.ok) {
    return canAccessPreviewSandbox({
      previewSandboxId: sandboxId,
      userId: local.userId,
    });
  }
  // Definitively invalid (bad sig, expired, malformed) — reject without network call
  if (local.reason !== 'no-keys' && local.reason !== 'no-key-for-kid') return false;
  // JWKS not yet available — fall back to network call
  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return false;
    return canAccessPreviewSandbox({
      previewSandboxId: sandboxId,
      userId: user.id,
    });
  } catch {
    return false;
  }
}

// ── Local-mode session tracking ─────────────────────────────────────────────
// Map key: "p{port}-{sandboxId}" → timestamp when authenticated.
const authenticatedSubdomains = new Map<string, number>();
const AUTH_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

function getSubdomainKey(sandboxId: string, port: number): string {
  return `p${port}-${sandboxId}`;
}

export function isSubdomainAuthenticated(sandboxId: string, port: number): boolean {
  const key = getSubdomainKey(sandboxId, port);
  const ts = authenticatedSubdomains.get(key);
  if (!ts) return false;
  if (Date.now() - ts > AUTH_SESSION_TTL_MS) {
    authenticatedSubdomains.delete(key);
    return false;
  }
  return true;
}

export function markSubdomainAuthenticated(sandboxId: string, port: number): void {
  authenticatedSubdomains.set(getSubdomainKey(sandboxId, port), Date.now());
}

// Periodic cleanup of expired sessions (every 30 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of authenticatedSubdomains) {
    if (now - ts > AUTH_SESSION_TTL_MS) authenticatedSubdomains.delete(key);
  }
}, 30 * 60 * 1000);
