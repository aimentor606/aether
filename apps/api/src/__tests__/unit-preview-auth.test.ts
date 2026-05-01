import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

let mockCanAccess = true;
let mockResolvedAccountId = 'acct-owner';
let mockSupabaseUser: { id: string; email?: string } | null = null;
let mockSandboxAccountId: string | null = 'acct-owner';

// Mock preview-ownership directly instead of mocking shared/db.
// This avoids contaminating other tests that need the real DB connection.
mock.module('../shared/preview-ownership', () => ({
  canAccessPreviewSandbox: async (_actorAccountId: string, _input: any) => mockCanAccess,
  clearPreviewOwnershipCache: () => {},
}));

mock.module('../shared/resolve-account', () => ({
  resolveAccountId: async () => mockResolvedAccountId,
  resolveAccountIdStrict: async () => mockResolvedAccountId,
  reconcileResolvedAccount: async () => {},
}));

mock.module('../repositories/api-keys', () => ({
  validateSecretKey: async (token: string) => {
    if (token === 'aether_owner') {
      return { isValid: true, accountId: 'acct-owner' };
    }
    if (token === 'aether_other') {
      return { isValid: true, accountId: 'acct-other' };
    }
    return { isValid: false, error: 'Invalid Aether token' };
  },
}));

mock.module('../shared/crypto', () => ({
  KEY_PREFIX: 'aether_',
  KEY_PREFIX_SANDBOX: 'aether_sb_',
  KEY_PREFIX_TUNNEL: 'aether_tnl_',
  KEY_PREFIX_PUBLIC: 'pk_',
  randomAlphanumeric: (length: number) => 'x'.repeat(length),
  isAetherToken: (token: string) => token.startsWith('aether_'),
  generateApiKeyPair: () => ({ publicKey: 'pk_testkey', secretKey: 'aether_testkey' }),
  generateSandboxKeyPair: () => ({ publicKey: 'pk_testkey', secretKey: 'aether_sb_testkey' }),
  generateTunnelToken: () => 'aether_tnl_testtoken',
  generateDeviceCode: () => 'ABCD-1234',
  isTunnelToken: (token: string) => token.startsWith('aether_tnl_'),
  hashSecretKey: (key: string) => 'testhash_' + key,
  verifySecretKey: (_key: string, _hash: string) => true,
  isApiKeySecretConfigured: () => true,
  timingSafeStringEqual: (_a: string, _b: string) => _a === _b,
  deriveSigningKey: (_token: string, _secret: string) => 'testsigningkey',
  signMessage: (_key: string, _payload: string, _nonce: number) => 'testsig',
  verifyMessageSignature: (_key: string, _payload: string, _nonce: number, _sig: string) => true,
  encryptCredential: (plaintext: string) => plaintext,
  decryptCredential: (encrypted: string) => encrypted,
}));

mock.module('../shared/jwt-verify', () => ({
  verifySupabaseJwt: async (token: string) => {
    if (token === 'jwt-owner') {
      return { ok: true, userId: 'user-owner', email: 'owner@aether.dev' };
    }
    if (token === 'jwt-other') {
      return { ok: true, userId: 'user-other', email: 'other@aether.dev' };
    }
    if (token === 'jwt-fallback-owner' || token === 'jwt-fallback-other') {
      return { ok: false, reason: 'no-keys' };
    }
    return { ok: false, reason: 'invalid' };
  },
}));

mock.module('../shared/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getUser: async () => ({ data: { user: mockSupabaseUser }, error: mockSupabaseUser ? null : { message: 'invalid' } }),
    },
  }),
}));

mock.module('../config', () => ({
  config: {
    DATABASE_URL: process.env.DATABASE_URL,
    API_KEY_SECRET: 'test-secret',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key',
  },
}));

const { combinedAuth } = await import('../middleware/auth');

interface PreviewAuthVariables {
  userId?: string;
  userEmail?: string;
  accountId?: string;
}

function createApp() {
  const app = new Hono<{ Variables: PreviewAuthVariables }>();
  app.use('/v1/p/:sandboxId/:port/*', combinedAuth);
  app.get('/v1/p/:sandboxId/:port/*', (c) => c.json({
    ok: true,
    userId: c.get('userId') ?? null,
    accountId: c.get('accountId') ?? null,
  }));
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ message: err.message }, err.status);
    }
    return c.json({ message: 'Internal server error' }, 500);
  });
  return app;
}

beforeEach(() => {
  mockCanAccess = true;
  mockSandboxAccountId = 'acct-owner';
  mockResolvedAccountId = 'acct-owner';
  mockSupabaseUser = null;
});

describe('preview auth ownership', () => {
  test('rejects request without auth token', async () => {
    const app = createApp();
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status');
    expect(res.status).toBe(401);
  });

  test('allows owner via Bearer aether token', async () => {
    const app = createApp();
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer aether_owner' },
    });
    expect(res.status).toBe(200);
  });

  test('allows owner via X-aether-Token header', async () => {
    const app = createApp();
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { 'X-aether-Token': 'aether_owner' },
    });
    expect(res.status).toBe(200);
  });

  test('allows owner via preview session cookie with aether token', async () => {
    const app = createApp();
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Cookie: '__preview_session=aether_owner' },
    });
    expect(res.status).toBe(200);
  });

  test('rejects non-owner aether token', async () => {
    const app = createApp();
    mockCanAccess = false;
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer aether_other' },
    });
    expect(res.status).toBe(403);
  });

  test('rejects invalid X-aether-Token', async () => {
    const app = createApp();
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { 'X-aether-Token': 'aether_invalid' },
    });
    expect(res.status).toBe(401);
  });

  test('allows jwt owner with matching account ownership', async () => {
    const app = createApp();
    mockResolvedAccountId = 'acct-owner';
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer jwt-owner' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accountId).toBe('acct-owner');
    expect(body.userId).toBe('user-owner');
  });

  test('rejects jwt user without ownership', async () => {
    const app = createApp();
    mockResolvedAccountId = 'acct-other';
    mockCanAccess = false;
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer jwt-other' },
    });
    expect(res.status).toBe(403);
  });

  test('allows jwt owner via preview session cookie', async () => {
    const app = createApp();
    mockResolvedAccountId = 'acct-owner';
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Cookie: '__preview_session=jwt-owner' },
    });
    expect(res.status).toBe(200);
  });

  test('allows jwt owner via Supabase fallback path', async () => {
    const app = createApp();
    mockResolvedAccountId = 'acct-owner';
    mockSupabaseUser = { id: 'user-fallback-owner', email: 'fallback@aether.dev' };
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer jwt-fallback-owner' },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.accountId).toBe('acct-owner');
    expect(body.userId).toBe('user-fallback-owner');
  });

  test('rejects jwt via Supabase fallback without ownership', async () => {
    const app = createApp();
    mockResolvedAccountId = 'acct-other';
    mockCanAccess = false;
    mockSupabaseUser = { id: 'user-fallback-other', email: 'other@aether.dev' };
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer jwt-fallback-other' },
    });
    expect(res.status).toBe(403);
  });

  test('rejects access when sandbox cannot be resolved', async () => {
    const app = createApp();
    mockCanAccess = false;
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer aether_owner' },
    });
    expect(res.status).toBe(403);
  });
});
