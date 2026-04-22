import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';
import { fetchCredentials, type LLMCredentials } from '../../llm/credentials';

export function useLLMCredentials(client: ApiClient | null) {
  return useQuery<LLMCredentials>({
    queryKey: ['llm', 'credentials'],
    queryFn: () => fetchCredentials(client!),
    enabled: !!client,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
