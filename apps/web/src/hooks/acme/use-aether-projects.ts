/**
 * Aether Projects hooks.
 *
 * Fetches from acme-master's /acme/projects API through the currently
 * active sandbox route (/v1/p/.../8000/acme/projects). This keeps Aether
 * workspace data on the same authenticated transport path as the rest of the
 * dashboard/OpenCode APIs.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useServerStore } from '@/stores/server-store';
import { authenticatedFetch } from '@/lib/auth-token';
import { useAuth } from '@/components/AuthProvider';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AetherProject {
  id: string;
  name: string;
  path: string;
  description: string;
  created_at: string;
  opencode_id: string | null;
  sessionCount?: number;
  delegationStats?: Record<string, number>;
}

export interface AetherProjectDetail extends AetherProject {
  delegations: Array<{
    session_id: string;
    project_id: string;
    prompt: string;
    agent: string;
    status: string;
    result: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
}

// ── Fetch helper ─────────────────────────────────────────────────────────────

async function acmeFetch<T>(serverUrl: string, apiPath: string, init?: RequestInit): Promise<T> {
  const url = `${serverUrl.replace(/\/+$/, '')}/acme/projects${apiPath}`;
  const res = await authenticatedFetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Aether API ${res.status}: ${text.slice(0, 100)}`);
  }
  return res.json();
}

// ── Query keys ───────────────────────────────────────────────────────────────

export const acmeKeys = {
  projects: () => ['acme', 'projects'] as const,
  project: (id: string) => ['acme', 'projects', id] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

export function useAetherProjects() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const serverVersion = useServerStore((s) => s.serverVersion);
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useQuery<AetherProject[]>({
    queryKey: [...acmeKeys.projects(), user?.id ?? 'anonymous', serverUrl, serverVersion],
    queryFn: () => acmeFetch<AetherProject[]>(serverUrl, ''),
    enabled: !isAuthLoading && !!user && !!serverUrl,
    staleTime: 30_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useAetherProject(id: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const serverVersion = useServerStore((s) => s.serverVersion);
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useQuery<AetherProjectDetail>({
    queryKey: [...acmeKeys.project(id), user?.id ?? 'anonymous', serverUrl, serverVersion],
    queryFn: () => acmeFetch<AetherProjectDetail>(serverUrl, `/${encodeURIComponent(id)}`),
    enabled: !isAuthLoading && !!user && !!serverUrl && !!id,
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Fetch sessions linked to a specific project.
 * Returns OpenCode session objects enriched with title, time, etc.
 */
export function useAetherProjectSessions(projectId: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const serverVersion = useServerStore((s) => s.serverVersion);
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useQuery<any[]>({
    queryKey: ['acme', 'projects', projectId, 'sessions', user?.id ?? 'anonymous', serverUrl, serverVersion],
    queryFn: () => acmeFetch<any[]>(serverUrl, `/${encodeURIComponent(projectId)}/sessions`),
    enabled: !isAuthLoading && !!user && !!serverUrl && !!projectId,
    staleTime: 15_000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string }) =>
      acmeFetch<AetherProject>(serverUrl, `/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: acmeKeys.project(vars.id) });
      qc.invalidateQueries({ queryKey: acmeKeys.projects() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  const serverUrl = useServerStore((s) => s.getActiveServerUrl());
  return useMutation({
    mutationFn: (id: string) =>
      acmeFetch<{ deleted: boolean; name: string; path: string }>(serverUrl, `/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: acmeKeys.projects() });
    },
  });
}
