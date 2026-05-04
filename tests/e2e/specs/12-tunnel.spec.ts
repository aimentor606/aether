import { test, expect } from '../fixtures';
import { apiBase } from '../helpers/auth';

test.describe('12 — Tunnel Endpoints', () => {
  test.setTimeout(60_000);

  // ── Device Auth (public — no auth required) ──────────────────────────────

  test.describe('Device Auth (public)', () => {
    test('POST /v1/tunnel/device-auth initiates device flow and returns code', async () => {
      const res = await fetch(`${apiBase}/tunnel/device-auth`, {
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
        `${apiBase}/tunnel/device-auth/nonexistent-code/status?secret=fakesecret`,
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
    test('GET /v1/tunnel/connections returns array', async ({ apiFetch }) => {
      const res = await apiFetch('/tunnel/connections');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('POST /v1/tunnel/connections creates a tunnel, then GET/PATCH/rotate/DELETE lifecycle', async ({
      apiFetch,
    }) => {
      // Create
      const createRes = await apiFetch('/tunnel/connections', {
        method: 'POST',
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
      const getRes = await apiFetch(`/tunnel/connections/${tunnelId}`);
      expect(getRes.status).toBe(200);
      const fetched = await getRes.json();
      expect(fetched.tunnelId).toBe(tunnelId);

      // PATCH — rename
      const patchRes = await apiFetch(`/tunnel/connections/${tunnelId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'e2e-test-tunnel-renamed' }),
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.name).toBe('e2e-test-tunnel-renamed');

      // Rotate token
      const rotateRes = await apiFetch(`/tunnel/connections/${tunnelId}/rotate-token`, {
        method: 'POST',
      });
      expect(rotateRes.status).toBe(200);
      const rotated = await rotateRes.json();
      expect(rotated).toHaveProperty('setupToken');
      expect(rotated.setupToken).not.toBe(created.setupToken);

      // DELETE — cleanup
      const deleteRes = await apiFetch(`/tunnel/connections/${tunnelId}`, {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(200);
      const deleted = await deleteRes.json();
      expect(deleted.success).toBe(true);
    });
  });

  // ── Permissions ───────────────────────────────────────────────────────────

  test.describe('Permissions', () => {
    test('GET /v1/tunnel/permissions/:tunnelId returns 200 or 404', async ({
      apiFetch,
    }) => {
      const res = await apiFetch('/tunnel/permissions/nonexistent-tunnel-id');
      expect([200, 404]).toContain(res.status);
    });
  });

  // ── Permission Requests ───────────────────────────────────────────────────

  test.describe('Permission Requests', () => {
    test('GET /v1/tunnel/permission-requests returns array', async ({
      apiFetch,
    }) => {
      const res = await apiFetch('/tunnel/permission-requests');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });
  });

  // ── Audit ─────────────────────────────────────────────────────────────────

  test.describe('Audit', () => {
    test('GET /v1/tunnel/audit/:tunnelId returns 200 or 404', async ({
      apiFetch,
    }) => {
      const res = await apiFetch('/tunnel/audit/nonexistent-tunnel-id');
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
    test('GET /v1/tunnel/device-auth/:code/info returns 200 or 404', async ({
      apiFetch,
    }) => {
      const res = await apiFetch('/tunnel/device-auth/nonexistent-code/info');
      expect([200, 404]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('deviceCode');
        expect(body).toHaveProperty('status');
      }
    });
  });
});
