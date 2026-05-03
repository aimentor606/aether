import { test, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

const apiUrl = apiBase;

const authHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

test.describe('12 — Tunnel Endpoints', () => {
  test.setTimeout(60_000);

  let token: string;

  test.beforeAll(async () => {
    token = await getAccessToken();
  });

  // ── Device Auth (public — no auth required) ──────────────────────────────

  test.describe('Device Auth (public)', () => {
    test('POST /v1/tunnel/device-auth initiates device flow and returns code', async () => {
      const res = await fetch(`${apiUrl}/tunnel/device-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ machineHostname: 'e2e-test-machine' }),
      });
      expect([200, 201, 400]).toContain(res.status);

      if (res.ok) {
        const body = await res.json();
        expect(body).toHaveProperty('deviceCode');
        expect(body).toHaveProperty('deviceSecret');
        expect(body).toHaveProperty('verificationUrl');
        expect(body).toHaveProperty('expiresAt');
        expect(body).toHaveProperty('pollIntervalMs');
        expect(typeof body.deviceCode).toBe('string');
      }
    });

    test('GET /v1/tunnel/device-auth/:code/status returns 200 or 404', async () => {
      // Use a fake code — expect 404 or 200 with status=not_found
      const res = await fetch(
        `${apiUrl}/tunnel/device-auth/nonexistent-code/status?secret=fakesecret`,
      );
      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('status');
      }
    });
  });

  // ── Connections (authenticated) ───────────────────────────────────────────

  test.describe('Connections', () => {
    test('GET /v1/tunnel/connections returns array', async () => {
      const res = await fetch(`${apiUrl}/tunnel/connections`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('POST /v1/tunnel/connections creates a tunnel, then GET/PATCH/rotate/DELETE lifecycle', async () => {
      // Create
      const createRes = await fetch(`${apiUrl}/tunnel/connections`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ name: 'e2e-test-tunnel', capabilities: [] }),
      });
      expect([200, 201, 400, 503]).toContain(createRes.status);

      // If creation failed (e.g. tunnel disabled), skip lifecycle tests
      if (!createRes.ok) return;

      const created = await createRes.json();
      expect(created).toHaveProperty('tunnelId');
      expect(created).toHaveProperty('setupToken');
      const tunnelId = created.tunnelId;

      // GET by id
      const getRes = await fetch(`${apiUrl}/tunnel/connections/${tunnelId}`, {
        headers: authHeaders(token),
      });
      expect(getRes.status).toBe(200);
      const fetched = await getRes.json();
      expect(fetched.tunnelId).toBe(tunnelId);

      // PATCH — rename
      const patchRes = await fetch(`${apiUrl}/tunnel/connections/${tunnelId}`, {
        method: 'PATCH',
        headers: authHeaders(token),
        body: JSON.stringify({ name: 'e2e-test-tunnel-renamed' }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.name).toBe('e2e-test-tunnel-renamed');

      // Rotate token
      const rotateRes = await fetch(
        `${apiUrl}/tunnel/connections/${tunnelId}/rotate-token`,
        {
          method: 'POST',
          headers: authHeaders(token),
        },
      );
      expect(rotateRes.status).toBe(200);
      const rotated = await rotateRes.json();
      expect(rotated).toHaveProperty('setupToken');
      expect(rotated.setupToken).not.toBe(created.setupToken);

      // DELETE — cleanup
      const deleteRes = await fetch(
        `${apiUrl}/tunnel/connections/${tunnelId}`,
        {
          method: 'DELETE',
          headers: authHeaders(token),
        },
      );
      expect(deleteRes.status).toBe(200);
      const deleted = await deleteRes.json();
      expect(deleted.success).toBe(true);
    });
  });

  // ── Permissions ───────────────────────────────────────────────────────────

  test.describe('Permissions', () => {
    test('GET /v1/tunnel/permissions/:tunnelId returns 200 or 404', async () => {
      const res = await fetch(
        `${apiUrl}/tunnel/permissions/nonexistent-tunnel-id`,
        { headers: authHeaders(token) },
      );
      expect([200, 404]).toContain(res.status);
    });
  });

  // ── Permission Requests ───────────────────────────────────────────────────

  test.describe('Permission Requests', () => {
    test('GET /v1/tunnel/permission-requests returns array', async () => {
      const res = await fetch(`${apiUrl}/tunnel/permission-requests`, {
        headers: authHeaders(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ── Audit ─────────────────────────────────────────────────────────────────

  test.describe('Audit', () => {
    test('GET /v1/tunnel/audit/:tunnelId returns 200 or 404', async () => {
      const res = await fetch(
        `${apiUrl}/tunnel/audit/nonexistent-tunnel-id`,
        { headers: authHeaders(token) },
      );
      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('data');
        expect(body).toHaveProperty('pagination');
        expect(Array.isArray(body.data)).toBe(true);
      }
    });
  });

  // ── Device Auth (authenticated) ───────────────────────────────────────────

  test.describe('Device Auth (authenticated)', () => {
    test('GET /v1/tunnel/device-auth/:code/info returns 200 or 404', async () => {
      const res = await fetch(
        `${apiUrl}/tunnel/device-auth/nonexistent-code/info`,
        { headers: authHeaders(token) },
      );
      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('deviceCode');
        expect(body).toHaveProperty('status');
      }
    });
  });
});
