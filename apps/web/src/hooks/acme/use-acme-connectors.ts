'use client';

import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/auth-token';
import { useAuth } from '@/components/AuthProvider';
import { useServerStore } from '@/stores/server-store';

export interface AcmeConnector {
  id: string;
  name: string;
  description: string | null;
  source: string | null;
  pipedream_slug: string | null;
  env_keys: string[] | null;
  notes: string | null;
  auto_generated: boolean;
  created_at: string;
  updated_at: string;
}

export function useAcmeConnectors() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useQuery({
    queryKey: ['acme', 'connectors', user?.id ?? 'anonymous', serverUrl],
    queryFn: async (): Promise<AcmeConnector[]> => {
      const url = `${serverUrl.replace(/\/+$/, '')}/acme/connectors`;
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error(`Failed to fetch connectors: ${res.status}`);
      const data = await res.json();
      return data.connectors ?? [];
    },
    enabled: !isAuthLoading && !!user && !!serverUrl,
    staleTime: 30_000,
  });
}
