import { test, expect } from '@playwright/test';

const apiUrl = process.env.E2E_API_URL || 'http://localhost:13738/v1';
const bareApiUrl = process.env.E2E_API_URL || 'http://localhost:13738/v1';

// The /health endpoint is mounted at the root level (no /v1 prefix),
// so we strip the trailing path to hit the bare origin.
const apiOrigin = bareApiUrl.replace(/\/v1\/?$/, '');

test.describe('06 — Public API Endpoints', () => {
  test('GET /health returns 200 with status, version, and env', async () => {
    const res = await fetch(`${apiOrigin}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('env');
    expect(body).toHaveProperty('service');
    expect(body).toHaveProperty('timestamp');
  });

  test('GET /v1/health returns 200 (alias of /health)', async () => {
    const res = await fetch(`${apiUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('env');
    expect(body).toHaveProperty('service');
  });

  test('GET /v1/system/status returns 200 with status flags', async () => {
    const res = await fetch(`${apiUrl}/system/status`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('maintenanceNotice');
    expect(body).toHaveProperty('technicalIssue');
    expect(body).toHaveProperty('updatedAt');
    expect(body.maintenanceNotice).toHaveProperty('enabled');
    expect(body.technicalIssue).toHaveProperty('enabled');
  });

  test('POST /v1/prewarm returns 200', async () => {
    const res = await fetch(`${apiUrl}/prewarm`, { method: 'POST' });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('success');
    expect(body.success).toBe(true);
  });

  test('GET /v1/setup/install-status returns 200 with installed field', async () => {
    const res = await fetch(`${apiUrl}/setup/install-status`);
    // May return 503 if database is not yet configured
    if (res.status === 503) {
      test.skip(true, 'Database not configured — install-status returned 503');
      return;
    }
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('installed');
    expect(typeof body.installed).toBe('boolean');
  });

  test('GET /v1/platform/sandbox/version returns 200 with version info', async () => {
    const res = await fetch(`${apiUrl}/platform/sandbox/version`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('version');
    expect(body).toHaveProperty('channel');
    expect(['stable', 'dev']).toContain(body.channel);
  });

  test('GET /v1/access/signup-status returns 200 with signupsEnabled', async () => {
    const res = await fetch(`${apiUrl}/access/signup-status`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('signupsEnabled');
    expect(typeof body.signupsEnabled).toBe('boolean');
  });

  test('POST /v1/access/check-email returns 200 or 400 for valid email', async () => {
    const res = await fetch(`${apiUrl}/access/check-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect([200, 400]).toContain(res.status);

    const body = await res.json();
    // On success: { allowed: boolean }
    // On 400 (no email): { error: string }
    if (res.status === 200) {
      expect(body).toHaveProperty('allowed');
      expect(typeof body.allowed).toBe('boolean');
    }
  });
});
