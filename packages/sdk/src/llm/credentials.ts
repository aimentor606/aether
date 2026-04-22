import type { ApiClient } from '../api/types';

export interface LLMCredentials {
  litellm_url: string;
  api_key: string;
  key_alias: string;
}

export async function fetchCredentials(api: ApiClient): Promise<LLMCredentials> {
  const res = await api.get<LLMCredentials>('/control/credentials');
  if (!res.success || !res.data) {
    throw new Error(res.error || 'Unable to fetch LLM credentials');
  }
  return res.data;
}

export function createLLMProvider(api: ApiClient) {
  let cached: LLMCredentials | null = null;

  return {
    async getCredentials(): Promise<LLMCredentials> {
      if (!cached) {
        cached = await fetchCredentials(api);
      }
      return cached;
    },
    get baseUrl(): string | undefined {
      return cached?.litellm_url;
    },
    get apiKey(): string | undefined {
      return cached?.api_key;
    },
    invalidate() {
      cached = null;
    },
  };
}
