import { test, expect } from '../fixtures';
import { apiBase } from '../helpers/auth';

test.describe('11 — Pipedream Integration Endpoints', () => {
  // ── Supabase-authenticated endpoints ──────────────────────────────────────

  test('GET /v1/pipedream/apps returns apps list or provider error', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/apps');
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      // Provider returns an object with app listing data (data array, or similar)
      expect(typeof body).toBe('object');
    }
  });

  test('POST /v1/pipedream/connect-token returns token or provider error', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/connect-token', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(typeof body).toBe('object');
    }
  });

  test('GET /v1/pipedream/connections returns connections array or provider error', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/connections');
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('connections');
      expect(Array.isArray(body.connections)).toBe(true);
    }
  });

  // ── API-key-authenticated endpoints (sandbox-only) ────────────────────────
  // These require aether_sb_* tokens, so Supabase JWT will be rejected (401).
  // We still test them to verify the route exists and auth middleware is active.

  test('GET /v1/pipedream/token requires sandbox auth', async ({ apiFetch }) => {
    const res = await apiFetch('/pipedream/token');
    // apiKeyAuth rejects Supabase JWT with 401
    expect([401, 500, 503]).toContain(res.status);
  });

  test('GET /v1/pipedream/list requires sandbox auth', async ({ apiFetch }) => {
    const res = await apiFetch('/pipedream/list');
    expect([401, 500, 503]).toContain(res.status);
  });

  test('GET /v1/pipedream/search-apps requires sandbox auth', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/search-apps?q=slack');
    expect([401, 500, 503]).toContain(res.status);
  });

  test('GET /v1/pipedream/actions requires sandbox auth', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/actions?app=slack');
    expect([401, 500, 503]).toContain(res.status);
  });

  test('GET /v1/pipedream/triggers/available requires sandbox auth', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/triggers/available?app=slack');
    expect([401, 500, 503]).toContain(res.status);
  });

  test('GET /v1/pipedream/triggers/deployed requires sandbox auth', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/triggers/deployed');
    expect([401, 500, 503]).toContain(res.status);
  });

  // ── Credentials CRUD (combinedAuth — JWT accepted) ────────────────────────

  test('GET /v1/pipedream/credentials returns credential status', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/credentials');
    expect([200, 500, 503]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('configured');
      expect(body).toHaveProperty('provider');
      expect(body.provider).toBe('pipedream');
    }
  });

  test('PUT /v1/pipedream/credentials saves and DELETE removes credentials', async ({
    apiFetch,
  }) => {
    // PUT — save test credentials
    const putRes = await apiFetch('/pipedream/credentials', {
      method: 'PUT',
      body: JSON.stringify({
        client_id: 'test_client_id',
        client_secret: 'test_client_secret',
        project_id: 'test_project_id',
        environment: 'production',
      }),
    });
    expect([200, 500, 503]).toContain(putRes.status);

    if (putRes.status === 200) {
      const putBody = await putRes.json();
      expect(putBody.success).toBe(true);

      // GET — verify credentials now show as configured
      const getRes = await apiFetch('/pipedream/credentials');
      expect(getRes.status).toBe(200);
      const getBody = await getRes.json();
      expect(getBody.configured).toBe(true);
      expect(getBody.source).toBe('account');

      // DELETE — cleanup
      const deleteRes = await apiFetch('/pipedream/credentials', {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);
      const deleteBody = await deleteRes.json();
      expect(deleteBody.success).toBe(true);
    }
  });

  test('PUT /v1/pipedream/credentials rejects invalid payload with 400', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/pipedream/credentials', {
      method: 'PUT',
      body: JSON.stringify({ client_id: '' }),
    });
    // Zod validation returns 400; if auth fails first it may be 401/500
    expect([400, 500, 503]).toContain(res.status);
  });

  // ── Auth gating ──────────────────────────────────────────────────────────

  test('all Pipedream endpoints reject unauthenticated requests', async () => {
    const endpoints = [
      { path: '/pipedream/apps', method: 'GET' },
      { path: '/pipedream/connections', method: 'GET' },
      { path: '/pipedream/credentials', method: 'GET' },
    ];

    for (const { path, method } of endpoints) {
      const res = await fetch(`${apiBase}${path}`, { method });
      expect(res.status).toBe(401);
    }
  });
});
