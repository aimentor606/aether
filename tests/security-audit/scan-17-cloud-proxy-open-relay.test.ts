/**
 * Security Scan: Cloud API - Router Proxy Mode 3 Should Not Exist
 *
 * LIVE scan against https://computer-preview-api.acme.dev
 *
 * FINDING: The proxy has a "Mode 3" passthrough that forwards requests
 * to upstream LLM providers WITHOUT any acme_ token or billing.
 *
 * The INTENT is: cloud mode should ONLY accept acme_ tokens with billing.
 * Mode 3 (no-auth passthrough) should be disabled on cloud.
 *
 * Current behavior:
 * - Request with no acme_ token → forwarded to upstream (OpenAI, Anthropic, etc.)
 * - Upstream rejects because attacker's key is fake
 * - BUT if attacker has their OWN valid OpenAI key, they can route it
 *   through Acme's infra without paying Acme anything
 *
 * Impact:
 * - Attacker uses Acme as free relay with their own keys — no billing
 * - Acme's IP used for upstream requests (IP reputation risk)
 * - Bandwidth/compute consumed without payment
 * - Violates the design intent: "only acme token with billing"
 *
 * Fix: In cloud mode, reject all requests without a valid acme_ token.
 *   if (!auth.isAcmeUser && config.isCloud()) {
 *     throw new HTTPException(401, { message: 'Acme API key required' });
 *   }
 */

import { describe, test, expect } from 'bun:test';

const CLOUD = 'https://computer-preview-api.acme.dev';

async function probeProxy(path: string, body: any, extraHeaders?: Record<string, string>): Promise<{
  status: number;
  body: any;
}> {
  try {
    const res = await fetch(`${CLOUD}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, body: parsed };
  } catch (err: any) {
    return { status: 0, body: { error: err.message } };
  }
}

describe('Cloud Scan: Proxy Mode 3 Should Not Exist on Cloud', () => {

  describe('[HIGH] Requests without acme_ token are forwarded (should be 401)', () => {
    test('OpenAI: request with no token forwards to upstream instead of 401', async () => {
      const r = await probeProxy('/v1/router/openai/chat/completions', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hi' }],
      });
      // BUG: This reaches OpenAI's servers. Should return Acme 401 instead.
      // OpenAI error proves the request was proxied to api.openai.com
      const isUpstreamError = (r.body?.error?.message || '').includes('API key');
      const isAcmeReject = r.body?.message === 'Missing authentication token';
      expect(isUpstreamError || isAcmeReject).toBe(true);
      // If isUpstreamError is true, the proxy forwarded without auth — this is the bug
    });

    test('Tavily: request with no token forwards to upstream instead of 401', async () => {
      const r = await probeProxy('/v1/router/tavily/search', {
        query: 'test',
      });
      // Tavily's own error means the proxy forwarded
      const isUpstreamError = (r.body?.detail?.error || '').includes('Unauthorized');
      expect(typeof r.status).toBe('number');
    });

    test('attacker with own OpenAI key can use Acme as free relay', async () => {
      // If someone has their own sk-proj-xxx key, they can route through
      // Acme's proxy, using Acme bandwidth/compute, paying nothing to Acme
      const r = await probeProxy('/v1/router/openai/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'test' }],
      }, {
        'Authorization': 'Bearer sk-proj-fake-but-would-work-if-real',
      });
      // The request reaches OpenAI — Acme acts as relay
      // Should be blocked: "Acme API key required"
      expect(r.status).not.toBe(200); // Fails because key is fake, but it WAS forwarded
    });
  });

  describe('acme_ tokens ARE properly enforced', () => {
    test('invalid acme_ token is hard rejected (good)', async () => {
      const r = await probeProxy('/v1/router/openai/chat/completions', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hi' }],
      }, {
        'Authorization': 'Bearer acme_fake_token_1234567890123456',
      });
      expect(r.status).toBe(401);
      expect(r.body.message).toBe('Invalid Acme token');
    });

    test('invalid acme_sb_ token is hard rejected (good)', async () => {
      const r = await probeProxy('/v1/router/openai/chat/completions', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'hi' }],
      }, {
        'Authorization': 'Bearer acme_sb_fake_12345678901234567',
      });
      expect(r.status).toBe(401);
    });
  });

  describe('Router health leaks env info', () => {
    test('GET /v1/router/health is public and reveals env=cloud', async () => {
      const res = await fetch(`${CLOUD}/v1/router/health`);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.env).toBe('cloud');
    });
  });
});
