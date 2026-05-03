import { test, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

const apiUrl = apiBase;

const headers = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: { limit: number; offset: number };
}

test.describe('07 — Vertical CRUD Endpoints', () => {
  test.setTimeout(60_000);

  let token: string;

  test.beforeAll(async () => {
    token = await getAccessToken();
  });

  // ── Finance ──────────────────────────────────────────────────────────────

  test.describe('Finance vertical', () => {
    test('GET /v1/verticals/finance/invoices returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/finance/invoices`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.meta).toBeDefined();
    });

    test('POST /v1/verticals/finance/invoices creates an invoice and GET by id returns it', async () => {
      // Create
      const createRes = await fetch(`${apiUrl}/verticals/finance/invoices`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify({
          vendor: 'Test Co',
          amount: 100,
          dueDate: '2026-06-01',
        }),
      });
      expect([200, 201]).toContain(createRes.status);
      const created = (await createRes.json()) as ApiResponse<{ id: string }>;
      expect(created.success).toBe(true);
      expect(created.data).toBeDefined();
      expect(created.data!.id).toBeTruthy();

      const invoiceId = created.data!.id;

      // Read back by id
      const getRes = await fetch(`${apiUrl}/verticals/finance/invoices/${invoiceId}`, {
        headers: headers(token),
      });
      expect(getRes.status).toBe(200);
      const fetched = (await getRes.json()) as ApiResponse<{ id: string }>;
      expect(fetched.success).toBe(true);
      expect(fetched.data!.id).toBe(invoiceId);

      // Clean up — delete
      const deleteRes = await fetch(`${apiUrl}/verticals/finance/invoices/${invoiceId}`, {
        method: 'DELETE',
        headers: headers(token),
      });
      expect([200, 204]).toContain(deleteRes.status);
    });

    test('GET /v1/verticals/finance/expenses returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/finance/expenses`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /v1/verticals/finance/ledger returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/finance/ledger`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /v1/verticals/finance/budgets returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/finance/budgets`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // ── Insurance ────────────────────────────────────────────────────────────

  test.describe('Insurance vertical', () => {
    test('GET /v1/verticals/insurance/policies returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/insurance/policies`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /v1/verticals/insurance/claims returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/insurance/claims`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /v1/verticals/insurance/leads returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/insurance/leads`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  // ── Advisor ──────────────────────────────────────────────────────────────

  test.describe('Advisor vertical', () => {
    test('GET /v1/verticals/advisor/portfolios returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/advisor/portfolios`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /v1/verticals/advisor/risk-assessments returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/advisor/risk-assessments`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    test('GET /v1/verticals/advisor/financial-plans returns 200 with envelope', async () => {
      const res = await fetch(`${apiUrl}/verticals/advisor/financial-plans`, {
        headers: headers(token),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as ApiResponse;
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });
  });
});
