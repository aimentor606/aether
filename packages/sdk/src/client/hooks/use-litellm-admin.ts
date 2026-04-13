import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

export interface ModelInfo {
  id: string;
  object: string;
  owned_by: string;
  context_window: number;
  pricing: { input: number; output: number };
  tier: string;
}

export interface LiteLLMHealth {
  status: string;
  error?: string;
}

/**
 * Hooks for the LiteLLM admin dashboard.
 */
export function useLiteLLMAdmin(client: ApiClient) {
  const models = useQuery<ModelInfo[]>({
    queryKey: ['litellm', 'models'],
    queryFn: async () => {
      const res = await client.get<ModelInfo[]>('/litellm-admin/models');
      return res.data ?? [];
    },
  });

  const health = useQuery<LiteLLMHealth>({
    queryKey: ['litellm', 'health'],
    queryFn: async () => {
      const res = await client.get<LiteLLMHealth>('/litellm-admin/health');
      return res.data ?? { status: 'unknown' };
    },
    refetchInterval: 30000,
  });

  const deployedModels = useQuery<Record<string, unknown>[]>({
    queryKey: ['litellm', 'model-info'],
    queryFn: async () => {
      const res = await client.get<Record<string, unknown>[]>('/litellm-admin/model/info');
      return res.data ?? [];
    },
  });

  return { models, health, deployedModels };
}
