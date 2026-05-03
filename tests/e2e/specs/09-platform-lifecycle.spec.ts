import { test, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

let token: string;
let createdKeyId: string | null = null;

test.describe('09 — Platform Lifecycle Endpoints', () => {
  test.beforeAll(async () => {
    token = await getAccessToken();
  });

  test.afterAll(async () => {
    // Cleanup: delete the test API key if it was created
    if (!createdKeyId) return;
    try {
      await fetch(`${apiBase}/platform/api-keys/${createdKeyId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort cleanup
    }
  });

  // ── Sandbox info ──────────────────────────────────────────────────────

  test('GET /v1/platform/sandbox/list — returns sandbox list', async () => {
    const res = await fetch(`${apiBase}/platform/sandbox/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
    // Response should contain a sandbox array (may be empty)
    expect(Array.isArray(body.sandboxes ?? body.data ?? body)).toBe(true);
  });

  test('GET /v1/platform/sandbox — returns active sandbox or 404', async () => {
    const res = await fetch(`${apiBase}/platform/sandbox`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body).toBeDefined();
    }
  });

  test('GET /v1/platform/providers — returns provider list', async () => {
    const res = await fetch(`${apiBase}/platform/providers`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  // ── Version info (public) ─────────────────────────────────────────────

  test('GET /v1/platform/sandbox/version — returns version', async () => {
    const res = await fetch(`${apiBase}/platform/sandbox/version`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('GET /v1/platform/sandbox/version/latest — returns latest version', async () => {
    const res = await fetch(`${apiBase}/platform/sandbox/version/latest`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  // ── API Keys CRUD ─────────────────────────────────────────────────────

  test('GET /v1/platform/api-keys — returns key list', async () => {
    const res = await fetch(`${apiBase}/platform/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();
  });

  test('POST /v1/platform/api-keys — creates a test key', async () => {
    const res = await fetch(`${apiBase}/platform/api-keys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title: 'E2E Test Key', expiresInDays: '1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeDefined();

    const keyData = body.data ?? body;
    createdKeyId = keyData.id ?? keyData.keyId ?? keyData.key_id;
    expect(createdKeyId).toBeTruthy();
  });

  test('created API key appears in GET list', async () => {
    // Ensure the key was created before checking
    if (!createdKeyId) {
      test.skip();
      return;
    }

    const res = await fetch(`${apiBase}/platform/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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

  test('PATCH /v1/platform/api-keys/{keyId}/revoke — revokes the test key', async () => {
    if (!createdKeyId) {
      test.skip();
      return;
    }

    const res = await fetch(`${apiBase}/platform/api-keys/${createdKeyId}/revoke`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
  });

  test('DELETE /v1/platform/api-keys/{keyId} — deletes the test key', async () => {
    if (!createdKeyId) {
      test.skip();
      return;
    }

    const res = await fetch(`${apiBase}/platform/api-keys/${createdKeyId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);

    // Mark cleaned up so afterAll doesn't try again
    createdKeyId = null;
  });

  // ── Backups (read-only, may 404) ──────────────────────────────────────

  test('GET /v1/platform/sandbox/{sandboxId}/backups — may 404 if no sandbox', async () => {
    // First try to obtain a sandbox ID from the list endpoint
    const listRes = await fetch(`${apiBase}/platform/sandbox/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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

    const res = await fetch(`${apiBase}/platform/sandbox/${sandboxId}/backups`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    // May 404 if sandbox has no backups
    expect([200, 404]).toContain(res.status);
  });
});
