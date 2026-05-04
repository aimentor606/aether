import { test, expect } from '../fixtures';
import { getAccessToken, apiBase } from '../helpers/auth';

let createdKeyId: string | null = null;

// afterAll does not receive fixtures — use raw fetch for cleanup
test.afterAll(async () => {
  if (!createdKeyId) return;
  try {
    const token = await getAccessToken();
    await fetch(`${apiBase}/platform/api-keys/${createdKeyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort cleanup
  }
});

test.describe('09 — Platform Lifecycle Endpoints', () => {
  // ── Sandbox info ──────────────────────────────────────────────────────

  test('GET /v1/platform/sandbox/list — returns sandbox list', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/platform/sandbox/list');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
    // Response should contain a sandbox array (may be empty)
    expect(Array.isArray(body.sandboxes ?? body.data ?? body)).toBe(true);
  });

  test('GET /v1/platform/sandbox — returns active sandbox or 404', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/platform/sandbox');
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toBeDefined();
    }
  });

  test('GET /v1/platform/providers — returns provider list', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/platform/providers');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  // ── Version info (public) ─────────────────────────────────────────────

  test('GET /v1/platform/sandbox/version — returns version', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/platform/sandbox/version');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('GET /v1/platform/sandbox/version/latest — returns latest version', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/platform/sandbox/version/latest');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  // ── API Keys CRUD ─────────────────────────────────────────────────────

  test('GET /v1/platform/api-keys — returns key list', async ({ apiFetch }) => {
    const res = await apiFetch('/platform/api-keys');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('POST /v1/platform/api-keys — creates a test key', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/platform/api-keys', {
      method: 'POST',
      body: JSON.stringify({ title: 'E2E Test Key', expiresInDays: '1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();

    const keyData = body.data ?? body;
    createdKeyId = keyData.id ?? keyData.keyId ?? keyData.key_id;
    expect(createdKeyId).toBeTruthy();
  });

  test('created API key appears in GET list', async ({ apiFetch }) => {
    // Ensure the key was created before checking
    if (!createdKeyId) {
      test.skip();
      return;
    }

    const res = await apiFetch('/platform/api-keys');
    expect(res.status).toBe(200);
    const body = await res.json();

    const keys: unknown[] = body.data ?? body.keys ?? body;
    expect(Array.isArray(keys)).toBe(true);

    const found = keys.some((k) => {
      const obj = k as Record<string, unknown>;
      const id = obj.id ?? obj.keyId ?? obj.key_id;
      return id === createdKeyId;
    });
    expect(found).toBe(true);
  });

  test('PATCH /v1/platform/api-keys/{keyId}/revoke — revokes the test key', async ({
    apiFetch,
  }) => {
    if (!createdKeyId) {
      test.skip();
      return;
    }

    const res = await apiFetch(`/platform/api-keys/${createdKeyId}/revoke`, {
      method: 'PATCH',
    });
    expect(res.status).toBe(200);
  });

  test('DELETE /v1/platform/api-keys/{keyId} — deletes the test key', async ({
    apiFetch,
  }) => {
    if (!createdKeyId) {
      test.skip();
      return;
    }

    const res = await apiFetch(`/platform/api-keys/${createdKeyId}`, {
      method: 'DELETE',
    });
    expect(res.status).toBe(200);

    // Mark cleaned up so afterAll doesn't try again
    createdKeyId = null;
  });

  // ── Backups (read-only, may 404) ──────────────────────────────────────

  test('GET /v1/platform/sandbox/{sandboxId}/backups — may 404 if no sandbox', async ({
    apiFetch,
  }) => {
    // First try to obtain a sandbox ID from the list endpoint
    const listRes = await apiFetch('/platform/sandbox/list');
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();

    const sandboxes: unknown[] = listBody.sandboxes ?? listBody.data ?? listBody;
    if (!Array.isArray(sandboxes) || sandboxes.length === 0) {
      test.skip();
      return;
    }

    const first = sandboxes[0] as Record<string, unknown>;
    const sandboxId = first.id ?? first.sandboxId ?? first.sandbox_id;
    if (!sandboxId) {
      test.skip();
      return;
    }

    const res = await apiFetch(`/platform/sandbox/${sandboxId}/backups`);
    // May 404 if sandbox has no backups
    expect([200, 404]).toContain(res.status);
  });
});
