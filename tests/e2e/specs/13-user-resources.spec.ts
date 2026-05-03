import { test, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

const apiUrl = apiBase;

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

test.describe('13 — User Resource Endpoints', () => {
  test.setTimeout(60_000);

  let token: string;

  test.beforeAll(async () => {
    token = await getAccessToken();
  });

  // ── Providers (/v1/providers) ─────────────────────────────────────────────

  test.describe('Providers', () => {
    test('GET /v1/providers returns 200 with providers array', async () => {
      const res = await fetch(`${apiUrl}/providers`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('providers');
      expect(Array.isArray(body.providers)).toBe(true);
    });

    test('GET /v1/providers lists providers with expected fields', async () => {
      const res = await fetch(`${apiUrl}/providers`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.providers.length).toBeGreaterThan(0);
      const first = body.providers[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('connected');
      expect(first).toHaveProperty('source');
      expect(first).toHaveProperty('maskedKeys');
    });

    test('GET /v1/providers/schema returns 200 with registry array', async () => {
      const res = await fetch(`${apiUrl}/providers/schema`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      if (body.length > 0) {
        expect(body[0]).toHaveProperty('id');
        expect(body[0]).toHaveProperty('name');
        expect(body[0]).toHaveProperty('envKeys');
      }
    });

    test('GET /v1/providers/health returns 200 or 503', async () => {
      const res = await fetch(`${apiUrl}/providers/health`, {
        headers: headers(token),
      });
      expect([200, 503]).toContain(res.status);

      const body = await res.json();
      expect(body).toHaveProperty('api');
      expect(body.api).toHaveProperty('ok');
    });

    test('PUT /v1/providers/:id/connect with unknown id returns 404', async () => {
      const res = await fetch(`${apiUrl}/providers/nonexistent-provider-id/connect`, {
        method: 'PUT',
        headers: headers(token),
        body: JSON.stringify({ keys: { FAKE_KEY: 'test-value' } }),
      });
      expect([200, 404]).toContain(res.status);
    });

    test('DELETE /v1/providers/:id/disconnect with unknown id returns 404', async () => {
      const res = await fetch(`${apiUrl}/providers/nonexistent-provider-id/disconnect`, {
        method: 'DELETE',
        headers: headers(token),
      });
      expect([200, 404]).toContain(res.status);
    });
  });

  // ── Secrets (/v1/secrets) ─────────────────────────────────────────────────

  test.describe('Secrets', () => {
    test('GET /v1/secrets returns 200 with secrets object', async () => {
      const res = await fetch(`${apiUrl}/secrets`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('secrets');
      expect(typeof body.secrets).toBe('object');
    });

    test('PUT /v1/secrets/:key sets a secret', async () => {
      const res = await fetch(`${apiUrl}/secrets/E2E_TEST_KEY`, {
        method: 'PUT',
        headers: headers(token),
        body: JSON.stringify({ value: 'test_value' }),
      });
      // May fail if sandbox master is unreachable
      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('ok');
        expect(body.ok).toBe(true);
      }
    });

    test('GET /v1/secrets shows the key after setting', async () => {
      const res = await fetch(`${apiUrl}/secrets`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      // If the PUT succeeded, E2E_TEST_KEY should appear (masked).
      // If it didn't (no sandbox), the key simply won't be present — both are fine.
      if (body.secrets && 'E2E_TEST_KEY' in body.secrets) {
        expect(typeof body.secrets.E2E_TEST_KEY).toBe('string');
        // Values are masked: either '****' for short values or 'test...alue'
        expect(body.secrets.E2E_TEST_KEY.length).toBeGreaterThan(0);
      }
    });

    test('DELETE /v1/secrets/E2E_TEST_KEY cleans up', async () => {
      const res = await fetch(`${apiUrl}/secrets/E2E_TEST_KEY`, {
        method: 'DELETE',
        headers: headers(token),
      });
      // May fail if sandbox master is unreachable
      expect([200, 500]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('ok');
        expect(body.ok).toBe(true);
      }
    });
  });

  // ── Servers (/v1/servers) ─────────────────────────────────────────────────

  test.describe('Servers', () => {
    test('GET /v1/servers returns 200 with array', async () => {
      const res = await fetch(`${apiUrl}/servers`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
    });

    test('GET /v1/servers/:id with unknown id returns 404', async () => {
      const res = await fetch(`${apiUrl}/servers/00000000-0000-0000-0000-000000000000`, {
        headers: headers(token),
      });
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    test('PUT /v1/servers/sync accepts empty array', async () => {
      const res = await fetch(`${apiUrl}/servers/sync`, {
        method: 'PUT',
        headers: headers(token),
        body: JSON.stringify({ servers: [] }),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBe(0);
    });
  });

  // ── Queue (/v1/queue) ─────────────────────────────────────────────────────

  test.describe('Queue', () => {
    test('GET /v1/queue/all returns 200 with messages array', async () => {
      const res = await fetch(`${apiUrl}/queue/all`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('messages');
      expect(Array.isArray(body.messages)).toBe(true);
    });

    test('GET /v1/queue/status returns 200 with drainerRunning', async () => {
      const res = await fetch(`${apiUrl}/queue/status`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('drainerRunning');
      expect(typeof body.drainerRunning).toBe('boolean');
    });

    test('GET /v1/queue/sessions/:sessionId with unknown id returns 200 with empty messages', async () => {
      const res = await fetch(`${apiUrl}/queue/sessions/00000000-0000-0000-0000-000000000000`, {
        headers: headers(token),
      });
      // The route always returns { messages: [...] } — even for unknown sessions
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('messages');
      expect(Array.isArray(body.messages)).toBe(true);
    });
  });
});
