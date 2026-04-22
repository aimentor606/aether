import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';

let mockSandboxAccountId: string | null = 'acct-owner';
let mockResolvedAccountId = 'acct-owner';
let mockSupabaseUser: { id: string; email?: string } | null = null;

mock.module('../shared/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (mockSandboxAccountId ? [{ accountId: mockSandboxAccountId }] : []),
        }),
      }),
    }),
  },
}));

mock.module('../shared/resolve-account', () => ({
  resolveAccountId: async () => mockResolvedAccountId,
  resolveAccountIdStrict: async () => mockResolvedAccountId,
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
  isAetherToken: (token: string) => token.startsWith('aether_'),
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

mock.module('../config', () => ({ config: {} }));

const { combinedAuth } = await import('../middleware/auth');
const { clearPreviewOwnershipCache } = await import('../shared/preview-ownership');

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
  mockSandboxAccountId = 'acct-owner';
  mockResolvedAccountId = 'acct-owner';
  mockSupabaseUser = null;
  clearPreviewOwnershipCache();
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
    mockSupabaseUser = { id: 'user-fallback-other', email: 'other@aether.dev' };
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer jwt-fallback-other' },
    });
    expect(res.status).toBe(403);
  });

  test('rejects access when sandbox cannot be resolved', async () => {
    const app = createApp();
    mockSandboxAccountId = null;
    const res = await app.request('/v1/p/8c70e5be-2f95-45ae-bd8d-5d07b65c631b/8000/session/status', {
      headers: { Authorization: 'Bearer aether_owner' },
    });
    expect(res.status).toBe(403);
  });
});
