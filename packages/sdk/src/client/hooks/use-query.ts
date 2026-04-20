import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

/**
 * Typed query hook wrapping @tanstack/react-query.
 * Uses the ApiClient from context.
 */
export function useQuery<T>(
  key: string[],
  fetcher: (client: ApiClient) => Promise<T>,
  client: ApiClient,
  options?: { enabled?: boolean },
) {
  return useTanstackQuery({
    queryKey: key,
    queryFn: () => fetcher(client),
    enabled: options?.enabled ?? true,
  });
}
