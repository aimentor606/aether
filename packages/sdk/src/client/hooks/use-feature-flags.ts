import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FeatureFlag {
  id: string;
  accountId: string;
  verticalId: string;
  featureName: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlagCreateParams {
  accountId: string;
  verticalId: string;
  featureName: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

/**
 * Hooks for feature flag management.
 */
export function useFeatureFlags(client: ApiClient, params?: { accountId?: string; verticalId?: string }) {
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams();
  if (params?.accountId) queryParams.set('accountId', params.accountId);
  if (params?.verticalId) queryParams.set('verticalId', params.verticalId);
  const qs = queryParams.toString();

  const flags = useQuery<FeatureFlag[]>({
    queryKey: ['feature-flags', params?.accountId, params?.verticalId],
    queryFn: async () => {
      const res = await client.get<FeatureFlag[]>(`/admin/api/feature-flags${qs ? `?${qs}` : ''}`);
      return res.data ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (data: FeatureFlagCreateParams) => {
      const res = await client.post<FeatureFlag>('/admin/api/feature-flags', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await client.delete(`/admin/api/feature-flags/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] });
    },
  });

  return { flags, upsert, remove };
}
