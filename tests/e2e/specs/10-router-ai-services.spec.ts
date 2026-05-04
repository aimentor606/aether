import { test, expect } from '../fixtures';

test.describe('10 — Router AI Service Endpoints', () => {
  // ─── Health (no auth required) ────────────────────────────────────────────

  test('GET /v1/router/health returns 200 with service info', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/health');
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('service', 'aether-router');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('env');
    expect(typeof body.timestamp).toBe('string');
  });

  // ─── Web Search (apiKeyAuth) ──────────────────────────────────────────────

  test('POST /v1/router/web-search returns 200 or 400/500 depending on config', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/web-search', {
      method: 'POST',
      body: JSON.stringify({ query: 'test query' }),
    });

    // May succeed (200) or fail if Tavily is not configured (400/500)
    expect([200, 400, 402, 500]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('results');
      expect(body).toHaveProperty('query', 'test query');
      expect(body).toHaveProperty('cost');
      expect(Array.isArray(body.results)).toBe(true);
    }
  });

  test('POST /v1/router/web-search with missing query returns 400', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/web-search', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('message');
    expect(body.message).toContain('Validation error');
  });

  // ─── Image Search (apiKeyAuth) ────────────────────────────────────────────

  test('POST /v1/router/image-search returns 200 or 500 depending on config', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/image-search', {
      method: 'POST',
      body: JSON.stringify({ query: 'test images' }),
    });

    // May succeed (200) or fail if Serper is not configured (500)
    expect([200, 400, 402, 500]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('results');
      expect(body).toHaveProperty('query', 'test images');
      expect(body).toHaveProperty('cost');
      expect(Array.isArray(body.results)).toBe(true);
    }
  });

  test('POST /v1/router/image-search with missing query returns 400', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/image-search', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty('message');
    expect(body.message).toContain('Validation error');
  });

  // ─── LiteLLM Admin (apiKeyAuth) ───────────────────────────────────────────

  test('GET /v1/router/litellm-admin/models returns 200 with model list', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/litellm-admin/models');

    // Models come from internal registry, should always work
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');
  });

  test('GET /v1/router/litellm-admin/health returns 200 with health status', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/litellm-admin/health');

    // Always returns 200 — wraps LiteLLM health in success/unhealthy
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('success');
    expect(body).toHaveProperty('data');
    if (body.success) {
      expect(typeof body.data).toBe('object');
    } else {
      expect(body.data).toHaveProperty('status', 'unhealthy');
      expect(body.data).toHaveProperty('error');
    }
  });

  test('GET /v1/router/litellm-admin/model/info returns 200 or 502', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/router/litellm-admin/model/info');

    // 200 if LiteLLM is running, 502 if not
    expect([200, 502]).toContain(res.status);

    if (res.status === 200) {
      const body = await res.json();
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data');
    }
  });

  // ─── Credentials (combinedAuth) ───────────────────────────────────────────

  test('GET /v1/control/credentials returns 200 or 502 depending on LiteLLM', async ({
    apiFetch,
  }) => {
    const res = await apiFetch('/control/credentials');

    // 200 with credentials, 502 if LiteLLM gateway unavailable
    expect([200, 500, 502]).toContain(res.status);

    const body = await res.json();
    if (res.status === 200 && body.success) {
      expect(body).toHaveProperty('data');
      expect(body.data).toHaveProperty('litellm_url');
      expect(body.data).toHaveProperty('api_key');
      expect(body.data).toHaveProperty('key_alias');
    } else {
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
    }
  });
});
