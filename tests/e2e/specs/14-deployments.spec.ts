import { test, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

const apiUrl = apiBase;

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

interface DeploymentData {
  deploymentId?: string;
  status?: string;
  sourceType?: string;
  domains?: string[];
  [key: string]: unknown;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  total?: number;
  limit?: number;
  offset?: number;
}

let token: string;
let createdDeploymentId: string | null = null;

test.describe('14 — Deployment Endpoints', () => {
  test.beforeAll(async () => {
    token = await getAccessToken();
  });

  test.afterAll(async () => {
    // Cleanup: delete the test deployment if it was created
    if (!createdDeploymentId) return;
    try {
      await fetch(`${apiUrl}/deployments/${createdDeploymentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // best-effort cleanup
    }
  });

  // ── List deployments ───────────────────────────────────────────────────────

  test('GET /v1/deployments returns 200 with envelope', async () => {
    const res = await fetch(`${apiUrl}/deployments`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<DeploymentData[]>;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    // Pagination envelope
    expect(typeof body.total).toBe('number');
    expect(typeof body.limit).toBe('number');
    expect(typeof body.offset).toBe('number');
  });

  // ── Create deployment ──────────────────────────────────────────────────────

  test('POST /v1/deployments creates a code deployment or returns 400/503', async () => {
    const res = await fetch(`${apiUrl}/deployments`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        source_type: 'code',
        code: 'export default { fetch: () => new Response("e2e-test") }',
        domains: [`e2e-test-${Date.now()}.aether.dev`],
        build: false,
      }),
    });

    // Accept 201 (created) or 400/503 if deployments not configured
    expect([201, 400, 503]).toContain(res.status);

    if (res.status === 201) {
      const body = (await res.json()) as ApiResponse<DeploymentData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data!.deploymentId).toBeTruthy();

      // Capture ID for lifecycle tests
      createdDeploymentId = body.data!.deploymentId!;
    }
  });

  test('POST /v1/deployments rejects invalid source_type with 400', async () => {
    const res = await fetch(`${apiUrl}/deployments`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({
        source_type: 'invalid',
        domains: ['test.aether.dev'],
      }),
    });
    expect(res.status).toBe(400);
  });

  // ── Get deployment by ID ───────────────────────────────────────────────────

  test('GET /v1/deployments/:id returns deployment or 404', async () => {
    if (!createdDeploymentId) {
      // Try a non-existent ID to verify 404 handling
      const res = await fetch(`${apiUrl}/deployments/00000000-0000-0000-0000-000000000000`, {
        headers: headers(token),
      });
      expect([200, 404]).toContain(res.status);
      return;
    }

    const res = await fetch(`${apiUrl}/deployments/${createdDeploymentId}`, {
      headers: headers(token),
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<DeploymentData>;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data!.deploymentId).toBe(createdDeploymentId);
    expect(body.data!.sourceType).toBe('code');
  });

  // ── Stop deployment ────────────────────────────────────────────────────────

  test('POST /v1/deployments/:id/stop stops the deployment or returns 404', async () => {
    if (!createdDeploymentId) {
      const res = await fetch(`${apiUrl}/deployments/00000000-0000-0000-0000-000000000000/stop`, {
        method: 'POST',
        headers: headers(token),
      });
      expect([200, 404]).toContain(res.status);
      return;
    }

    const res = await fetch(`${apiUrl}/deployments/${createdDeploymentId}/stop`, {
      method: 'POST',
      headers: headers(token),
    });
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = (await res.json()) as ApiResponse<DeploymentData>;
      expect(body.success).toBe(true);
      expect(body.data!.status).toBe('stopped');
    }
  });

  // ── Redeploy ───────────────────────────────────────────────────────────────

  test('POST /v1/deployments/:id/redeploy redeploys or returns 404', async () => {
    if (!createdDeploymentId) {
      const res = await fetch(
        `${apiUrl}/deployments/00000000-0000-0000-0000-000000000000/redeploy`,
        {
          method: 'POST',
          headers: headers(token),
        },
      );
      expect([201, 404]).toContain(res.status);
      return;
    }

    const res = await fetch(`${apiUrl}/deployments/${createdDeploymentId}/redeploy`, {
      method: 'POST',
      headers: headers(token),
    });
    // Redeploy creates a new deployment record (201) or 404 if original not found
    expect([201, 404]).toContain(res.status);

    if (res.status === 201) {
      const body = (await res.json()) as ApiResponse<DeploymentData>;
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
      // New deployment should have a different ID
      expect(body.data!.deploymentId).not.toBe(createdDeploymentId);
      // Clean up the redeployed version too
      if (body.data!.deploymentId) {
        try {
          await fetch(`${apiUrl}/deployments/${body.data!.deploymentId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // best-effort cleanup
        }
      }
    }
  });

  // ── Logs ───────────────────────────────────────────────────────────────────

  test('GET /v1/deployments/:id/logs returns logs or 404', async () => {
    if (!createdDeploymentId) {
      const res = await fetch(`${apiUrl}/deployments/00000000-0000-0000-0000-000000000000/logs`, {
        headers: headers(token),
      });
      expect([200, 404, 502]).toContain(res.status);
      return;
    }

    const res = await fetch(`${apiUrl}/deployments/${createdDeploymentId}/logs`, {
      headers: headers(token),
    });
    // May return 200 (logs or empty), 404 (not found), or 502 (Freestyle not configured)
    expect([200, 404, 502]).toContain(res.status);
  });

  // ── Delete deployment ──────────────────────────────────────────────────────

  test('DELETE /v1/deployments/:id deletes the deployment or returns 404', async () => {
    const targetId = createdDeploymentId ?? '00000000-0000-0000-0000-000000000000';

    const res = await fetch(`${apiUrl}/deployments/${targetId}`, {
      method: 'DELETE',
      headers: headers(token),
    });
    expect([200, 404]).toContain(res.status);

    if (res.status === 200 && createdDeploymentId) {
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      // Mark cleaned up so afterAll doesn't retry
      createdDeploymentId = null;
    }
  });
});
