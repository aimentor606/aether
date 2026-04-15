import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PoolHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, { ok: boolean; message?: string }>;
}

export interface PoolConfig {
  min_idle: number;
  max_total: number;
  idle_timeout_ms: number;
  creation_timeout_ms: number;
  health_check_interval_ms: number;
}

export interface PoolStats {
  total: number;
  idle: number;
  active: number;
  pending_creation: number;
  failed_creations: number;
  avg_creation_time_ms: number;
}

export interface PooledSandbox {
  id: string;
  status: 'idle' | 'active' | 'creating' | 'error';
  resource_id: string;
  created_at: string;
  last_used_at?: string;
  metadata?: Record<string, unknown>;
}

export interface PooledSandboxList {
  sandboxes: PooledSandbox[];
  total: number;
}

export interface ReplenishResponse {
  created: number;
  message: string;
}

export interface ForceCreateResponse {
  sandbox_ids: string[];
  created: number;
  failed: number;
}

export interface CleanupResponse {
  removed: number;
  message: string;
}

export interface RestartResponse {
  restarted: boolean;
  message: string;
}

export interface RemoveResponse {
  removed: number;
  failed: number;
}

export interface PoolResource {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Options ────────────────────────────────────────────────────────────────────

export interface AdminSandboxPoolOptions {
  listLimit?: number;
}

// ─── Hook factory ───────────────────────────────────────────────────────────────

const QUERY_KEY = 'admin-sandbox-pool';

/**
 * Create admin sandbox pool hooks bound to an ApiClient.
 */
export function useAdminSandboxPool(client: ApiClient, opts: AdminSandboxPoolOptions = {}) {
  const queryClient = useQueryClient();
  const invalidate = (keys: string[]) =>
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, ...keys] });

  // ─── Queries ─────────────────────────────────────────────────────────────

  const health = useQuery<PoolHealth>({
    queryKey: [QUERY_KEY, 'health'],
    queryFn: async () => {
      const res = await client.get<PoolHealth>('/admin/sandbox-pool/health');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const stats = useQuery<PoolStats>({
    queryKey: [QUERY_KEY, 'stats'],
    queryFn: async () => {
      const res = await client.get<PoolStats>('/admin/sandbox-pool/stats');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const list = useQuery<PooledSandboxList>({
    queryKey: [QUERY_KEY, 'list', opts.listLimit],
    queryFn: async () => {
      const params = opts.listLimit ? `?limit=${opts.listLimit}` : '';
      const res = await client.get<PooledSandboxList>(`/admin/sandbox-pool/list${params}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const resources = useQuery<PoolResource[]>({
    queryKey: [QUERY_KEY, 'resources'],
    queryFn: async () => {
      const res = await client.get<PoolResource[]>('/admin/sandbox-pool/resources');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 10_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const replenish = useMutation({
    mutationFn: async () => {
      const res = await client.post<ReplenishResponse>('/admin/sandbox-pool/replenish');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['stats', 'list']);
    },
  });

  const forceCreate = useMutation({
    mutationFn: async ({ count, resource_id }: { count: number; resource_id?: string }) => {
      const res = await client.post<ForceCreateResponse>('/admin/sandbox-pool/force-create', {
        count,
        resource_id,
      });
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['stats', 'list']);
    },
  });

  const cleanup = useMutation({
    mutationFn: async () => {
      const res = await client.post<CleanupResponse>('/admin/sandbox-pool/cleanup');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['stats', 'list']);
    },
  });

  const restart = useMutation({
    mutationFn: async () => {
      const res = await client.post<RestartResponse>('/admin/sandbox-pool/restart-service');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['health', 'stats', 'list']);
    },
  });

  const remove = useMutation({
    mutationFn: async ({
      sandbox_ids,
      delete_sandbox,
    }: {
      sandbox_ids: string[];
      delete_sandbox?: boolean;
    }) => {
      const res = await client.post<RemoveResponse>('/admin/sandbox-pool/remove', {
        sandbox_ids,
        delete_sandbox,
      });
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['stats', 'list']);
    },
  });

  const createResource = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await client.post<PoolResource>('/admin/sandbox-pool/resources', data);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['resources']);
    },
  });

  const updateResource = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await client.patch<PoolResource>(`/admin/sandbox-pool/resources/${id}`, data);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['resources']);
    },
  });

  const deleteResource = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.delete(`/admin/sandbox-pool/resources/${id}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['resources']);
    },
  });

  return {
    // queries
    health,
    stats,
    list,
    resources,
    // mutations
    replenish,
    forceCreate,
    cleanup,
    restart,
    remove,
    createResource,
    updateResource,
    deleteResource,
  };
}
