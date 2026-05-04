import { test, expect } from '../fixtures';
import { getAccessToken, apiBase } from '../helpers/auth';

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

let createdDeploymentId: string | null = null;

// afterAll does not receive fixtures — use raw fetch for cleanup
test.afterAll(async () => {
  if (!createdDeploymentId) return;
  try {
    const token = await getAccessToken();
    await fetch(`${apiBase}/deployments/${createdDeploymentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // best-effort cleanup
  }
});

test.describe('14 — Deployment Endpoints', () => {
  // ── List deployments ───────────────────────────────────────────────────────

  test('GET /v1/deployments returns 200 with envelope', async ({ apiFetch }) => {
    const res = await apiFetch('/deployments');
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

  test('POST /v1/deployments creates a code deployment or returns 400/503', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/deployments', {
      method: 'POST',
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

  test('POST /v1/deployments rejects invalid source_type with 400', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/deployments', {
      method: 'POST',
      body: JSON.stringify({
        source_type: 'invalid',
        domains: ['test.aether.dev'],
      }),
    });
    expect(res.status).toBe(400);
  });

  // ── Get deployment by ID ───────────────────────────────────────────────────

  test('GET /v1/deployments/:id returns deployment or 404', async ({
    apiFetch,
  }) => {
    if (!createdDeploymentId) {
      // Try a non-existent ID to verify 404 handling
      const res = await apiFetch('/deployments/00000000-0000-0000-0000-000000000000');
      expect([200, 404]).toContain(res.status);
      return;
    }

    const res = await apiFetch(`/deployments/${createdDeploymentId}`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as ApiResponse<DeploymentData>;
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data!.deploymentId).toBe(createdDeploymentId);
    expect(body.data!.sourceType).toBe('code');
  });

  // ── Stop deployment ────────────────────────────────────────────────────────

  test('POST /v1/deployments/:id/stop stops the deployment or returns 404', async ({
    apiFetch,
  }) => {
    if (!createdDeploymentId) {
      const res = await apiFetch('/deployments/00000000-0000-0000-0000-000000000000/stop', {
        method: 'POST',
      });
      expect([200, 404]).toContain(res.status);
      return;
    }

    const res = await apiFetch(`/deployments/${createdDeploymentId}/stop`, {
      method: 'POST',
    });
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = (await res.json()) as ApiResponse<DeploymentData>;
      expect(body.success).toBe(true);
      expect(body.data!.status).toBe('stopped');
    }
  });

  // ── Redeploy ───────────────────────────────────────────────────────────────

  test('POST /v1/deployments/:id/redeploy redeploys or returns 404', async ({
    apiFetch,
  }) => {
    if (!createdDeploymentId) {
      const res = await apiFetch(
        '/deployments/00000000-0000-0000-0000-000000000000/redeploy',
        {
          method: 'POST',
        },
      );
      expect([201, 404]).toContain(res.status);
      return;
    }

    const res = await apiFetch(`/deployments/${createdDeploymentId}/redeploy`, {
      method: 'POST',
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
          const token = await getAccessToken();
          await fetch(`${apiBase}/deployments/${body.data!.deploymentId}`, {
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

  test('GET /v1/deployments/:id/logs returns logs or 404', async ({
    apiFetch,
  }) => {
    if (!createdDeploymentId) {
      const res = await apiFetch('/deployments/00000000-0000-0000-0000-000000000000/logs');
      expect([200, 404, 502]).toContain(res.status);
      return;
    }

    const res = await apiFetch(`/deployments/${createdDeploymentId}/logs`);
    // May return 200 (logs or empty), 404 (not found), or 502 (Freestyle not configured)
    expect([200, 404, 502]).toContain(res.status);
  });

  // ── Delete deployment ──────────────────────────────────────────────────────

  test('DELETE /v1/deployments/:id deletes the deployment or returns 404', async ({
    apiFetch,
  }) => {
    const targetId = createdDeploymentId ?? '00000000-0000-0000-0000-000000000000';

    const res = await apiFetch(`/deployments/${targetId}`, {
      method: 'DELETE',
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
