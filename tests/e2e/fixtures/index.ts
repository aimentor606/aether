import { test as authBase, expect } from './auth.fixture';
import { getAccessToken, apiBase } from '../helpers/auth';

type IntegrationFixtures = {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

export const test = authBase.extend<IntegrationFixtures>({
  apiFetch: async ({ authenticatedPage }, use) => {
    let token: string;
    try {
      const { getAccessTokenFromPage } = await import('../helpers/auth');
      token = await getAccessTokenFromPage(authenticatedPage);
    } catch {
      token = await getAccessToken();
    }
    const fetchWithAuth = (path: string, init: RequestInit = {}): Promise<Response> => {
      const url = path.startsWith('http') ? path : `${apiBase}${path}`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...((init.headers as Record<string, string>) ?? {}),
        Authorization: `Bearer ${token}`,
      };
      return fetch(url, { ...init, headers });
    };
    await use(fetchWithAuth);
  },
});

export { expect };
