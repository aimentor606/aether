'use client';

import { useQuery } from '@tanstack/react-query';
import { useServerStore } from '@/stores/server-store';
import { authenticatedFetch } from '@/lib/auth-token';

interface AetherAgent {
  id: string;
  project_id: string;
  session_id: string;
  parent_session_id: string;
  agent_type: string;
  description: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  result: string | null;
  created_at: string;
  updated_at: string;
}

export function useAetherAgents(projectId?: string) {
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  const qs = params.toString() ? `?${params}` : '';
  return useQuery({
    queryKey: ['acme', 'agents', projectId],
    queryFn: async () => {
      const url = `${serverUrl.replace(/\/+$/, '')}/acme/agents${qs}`;
      const res = await authenticatedFetch(url);
      if (!res.ok) return [];
      return res.json() as Promise<AetherAgent[]>;
    },
    enabled: !!projectId,
    refetchInterval: 5000,
  });
}

export type { AetherAgent };
