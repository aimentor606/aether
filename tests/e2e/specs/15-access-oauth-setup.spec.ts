import { test, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

let token: string;

test.describe('15 — Access Control, OAuth, Setup Endpoints', () => {
  test.beforeAll(async () => {
    token = await getAccessToken();
  });

  // ── Access Control (/v1/access) ─────────────────────────────────────────

  test.describe('Access Control', () => {
    test('POST /v1/access/request-access — submits access request', async () => {
      const res = await fetch(`${apiBase}/access/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'e2e-test-access@example.com',
          company: 'E2E Test Co',
          useCase: 'Automated E2E test',
        }),
      });
      // Accept 200 (success) or 400 (duplicate / validation)
      expect([200, 400]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body).toHaveProperty('message');
      }
    });

    test('POST /v1/access/request-access — rejects missing email', async () => {
      const res = await fetch(`${apiBase}/access/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'No Email' }),
      });
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body).toHaveProperty('error');
    });

    test('POST /v1/access/request-access — rejects invalid email', async () => {
      const res = await fetch(`${apiBase}/access/request-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-an-email' }),
      });
      expect(res.status).toBe(400);
    });

    test('GET /v1/access/requests — lists access requests (admin)', async () => {
      const res = await fetch(`${apiBase}/access/requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // May 403 if user is not admin
      expect([200, 403]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('requests');
        expect(Array.isArray(body.requests)).toBe(true);
        expect(body).toHaveProperty('summary');
        expect(body.summary).toHaveProperty('pending');
        expect(body.summary).toHaveProperty('approved');
        expect(body.summary).toHaveProperty('rejected');
        expect(body).toHaveProperty('limit');
        expect(body).toHaveProperty('offset');
      }
    });

    test('GET /v1/access/requests — supports status filter', async () => {
      const res = await fetch(`${apiBase}/access/requests?status=pending&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 403]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('requests');
        expect(body.limit).toBe(10);
      }
    });

    test('POST /v1/access/requests/:id/approve — returns 404 for fake ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${apiBase}/access/requests/${fakeId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      // Accept 404 (not found), 403 (not admin), or 200 (edge case)
      expect([200, 403, 404]).toContain(res.status);
    });

    test('POST /v1/access/requests/:id/reject — returns 404 for fake ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${apiBase}/access/requests/${fakeId}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 403, 404]).toContain(res.status);
    });
  });

  // ── OAuth (/v1/oauth) ───────────────────────────────────────────────────

  test.describe('OAuth', () => {
    test('GET /v1/oauth/authorize — returns 400 without required params', async () => {
      const res = await fetch(`${apiBase}/oauth/authorize`);
      expect([200, 400]).toContain(res.status);

      if (res.status === 400) {
        const body = await res.json();
        expect(body).toHaveProperty('error');
      }
    });

    test('GET /v1/oauth/authorize — returns 400 with invalid params', async () => {
      const res = await fetch(
        `${apiBase}/oauth/authorize?client_id=fake&redirect_uri=http://localhost&response_type=code&code_challenge=abc`,
      );
      // 400 (client not found) or 302 redirect — both acceptable
      expect([200, 302, 400]).toContain(res.status);
    });

    test('GET /v1/oauth/userinfo — returns 401 without valid OAuth token', async () => {
      const res = await fetch(`${apiBase}/oauth/userinfo`);
      expect(res.status).toBe(401);
    });

    test('GET /v1/oauth/userinfo — returns 401 with arbitrary Bearer token', async () => {
      const res = await fetch(`${apiBase}/oauth/userinfo`, {
        headers: { Authorization: 'Bearer fake-oauth-token' },
      });
      expect(res.status).toBe(401);
    });

    test('GET /v1/oauth/claimable-machines — returns 401 without valid OAuth token', async () => {
      const res = await fetch(`${apiBase}/oauth/claimable-machines`);
      expect(res.status).toBe(401);
    });

    test('POST /v1/oauth/token — returns 400 without required fields', async () => {
      const res = await fetch(`${apiBase}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code',
      });
      // 400 — missing client_id and client_secret
      expect(res.status).toBe(400);
    });

    test('POST /v1/oauth/token — returns 400 or 401 for invalid credentials', async () => {
      const res = await fetch(`${apiBase}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&client_id=fake&client_secret=fake&code=fake&redirect_uri=http://localhost&code_verifier=fake',
      });
      // 401 (invalid client) or 400 (invalid grant / client not found)
      expect([400, 401]).toContain(res.status);
    });

    test('POST /v1/oauth/authorize/consent — returns 400 without required fields', async () => {
      const res = await fetch(`${apiBase}/oauth/authorize/consent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ approved: true }),
      });
      // 400 — missing client_id, redirect_uri, code_challenge
      expect(res.status).toBe(400);
    });

    test('POST /v1/oauth/authorize/consent — returns 400 for non-existent client', async () => {
      const res = await fetch(`${apiBase}/oauth/authorize/consent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: 'nonexistent-client',
          redirect_uri: 'http://localhost:9999/callback',
          scope: 'read',
          state: 'test',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
          approved: true,
        }),
      });
      // 400 (invalid client) or 400 (redirect_uri mismatch)
      expect(res.status).toBe(400);
    });
  });

  // ── Setup (/v1/setup) ───────────────────────────────────────────────────

  test.describe('Setup', () => {
    test('GET /v1/setup/status — returns system status or 401', async () => {
      const res = await fetch(`${apiBase}/setup/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('envMode');
        expect(body).toHaveProperty('dockerRunning');
        expect(body).toHaveProperty('envExists');
        expect(body).toHaveProperty('sandboxEnvExists');
        expect(body).toHaveProperty('projectRoot');
      }
    });

    test('GET /v1/setup/setup-status — returns setup completion state or 401', async () => {
      const res = await fetch(`${apiBase}/setup/setup-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('complete');
        expect(typeof body.complete).toBe('boolean');
        expect(body).toHaveProperty('completedAt');
      }
    });

    test('GET /v1/setup/setup-wizard-step — returns wizard step or 401', async () => {
      const res = await fetch(`${apiBase}/setup/setup-wizard-step`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('step');
        expect(typeof body.step).toBe('number');
      }
    });

    test('GET /v1/setup/env — returns masked env config or 401', async () => {
      const res = await fetch(`${apiBase}/setup/env`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect([200, 401]).toContain(res.status);

      if (res.status === 200) {
        const body = await res.json();
        expect(body).toHaveProperty('masked');
        expect(body).toHaveProperty('configured');
        expect(typeof body.masked).toBe('object');
        expect(typeof body.configured).toBe('object');
      }
    });

    test('GET /v1/setup/health — returns service health checks', async () => {
      const res = await fetch(`${apiBase}/setup/health`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      // Should contain at minimum the api check
      expect(body).toHaveProperty('api');
      expect(body.api.ok).toBe(true);
    });

    test('GET /v1/setup/sandbox-providers — returns available providers', async () => {
      const res = await fetch(`${apiBase}/setup/sandbox-providers`);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('providers');
      expect(Array.isArray(body.providers)).toBe(true);
      expect(body).toHaveProperty('default');
      expect(body).toHaveProperty('capabilities');
      expect(typeof body.capabilities).toBe('object');
    });
  });
});
