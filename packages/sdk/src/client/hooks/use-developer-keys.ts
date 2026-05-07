import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

export interface DeveloperKey {
  key_id: string;
  public_key: string;
  title: string;
  description: string | null;
  status: 'active' | 'revoked' | 'expired';
  scopes: string[] | null;
  allowed_models: string[] | null;
  rate_limit_per_minute: number | null;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

export interface CreateDeveloperKeyParams {
  title: string;
  description?: string;
  allowed_models?: string[];
  rate_limit_per_minute?: number;
  expires_in_days?: number;
}

export interface CreateDeveloperKeyResult extends DeveloperKey {
  secret_key: string;
}

export function useDeveloperKeys(client: ApiClient) {
  const queryClient = useQueryClient();

  const keys = useQuery<DeveloperKey[]>({
    queryKey: ['developer-keys'],
    queryFn: async () => {
      const res = await client.get<DeveloperKey[]>('/router/developer-keys');
      return res.data ?? [];
    },
  });

  const create = useMutation<CreateDeveloperKeyResult, Error, CreateDeveloperKeyParams>({
    mutationFn: async (params) => {
      const res = await client.post<CreateDeveloperKeyResult>('/router/developer-keys', params);
      if (!res.data) throw new Error('Failed to create developer key');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-keys'] });
    },
  });

  const revoke = useMutation<void, Error, string>({
    mutationFn: async (keyId) => {
      await client.patch(`/router/developer-keys/${keyId}/revoke`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-keys'] });
    },
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: async (keyId) => {
      await client.delete(`/router/developer-keys/${keyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['developer-keys'] });
    },
  });

  return { keys, create, revoke, remove };
}
