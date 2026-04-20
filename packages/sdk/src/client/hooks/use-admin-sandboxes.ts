import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AdminSandbox {
  sandboxId: string;
  accountId: string;
  name: string;
  provider: string;
  externalId: string;
  status: string;
  baseUrl: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
  accountName: string;
  ownerEmail: string;
}

export interface AdminSandboxesParams {
  search?: string;
  status?: string;
  provider?: string;
  page?: number;
  limit?: number;
}

export interface AdminSandboxesResponse {
  sandboxes: AdminSandbox[];
  total: number;
  page: number;
  limit: number;
}

// ─── Hooks factory ─────────────────────────────────────────────────────────────

/**
 * Create admin sandbox management hooks bound to an ApiClient.
 */
export function useAdminSandboxes(client: ApiClient, params?: AdminSandboxesParams) {
  const queryClient = useQueryClient();

  const queryString = new URLSearchParams();
  if (params?.search) queryString.set('search', params.search);
  if (params?.status) queryString.set('status', params.status);
  if (params?.provider) queryString.set('provider', params.provider);
  if (params?.page !== undefined) queryString.set('page', String(params.page));
  if (params?.limit !== undefined) queryString.set('limit', String(params.limit));
  const qs = queryString.toString();

  const list = useQuery<AdminSandboxesResponse>({
    queryKey: ['admin', 'sandboxes', params],
    queryFn: async () => {
      const res = await client.get<AdminSandboxesResponse>(`/admin/api/sandboxes${qs ? `?${qs}` : ''}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    placeholderData: (prev) => prev,
  });

  const deleteSandbox = useMutation({
    mutationFn: async (sandboxId: string) => {
      const res = await client.delete<void>(`/admin/api/sandboxes/${sandboxId}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'sandboxes'] });
    },
  });

  return { list, deleteSandbox };
}
