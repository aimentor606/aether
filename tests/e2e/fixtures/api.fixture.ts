import { test as base, expect } from '@playwright/test';
import { getAccessToken, apiBase } from '../helpers/auth';

type ApiFixture = {
  accessToken: string;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export const test = base.extend<ApiFixture>({
  accessToken: async ({}, use) => {
    const token = await getAccessToken();
    await use(token);
  },

  apiFetch: async ({ accessToken }, use) => {
    const fetchWithAuth = (path: string, init: RequestInit = {}): Promise<Response> => {
      const url = path.startsWith('http') ? path : `${apiBase}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init.headers as Record<string, string>) ?? {}),
        Authorization: `Bearer ${accessToken}`,
      };
      return fetch(url, { ...init, headers });
    };
    await use(fetchWithAuth);
  },
});

export { expect };
