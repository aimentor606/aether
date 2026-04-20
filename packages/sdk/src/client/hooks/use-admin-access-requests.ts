import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AccessRequest {
  id: string;
  email: string;
  company: string;
  useCase: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccessRequestsResponse {
  requests: AccessRequest[];
  summary: { pending: number; approved: number; rejected: number };
  limit: number;
  offset: number;
}

export interface AccessRequestsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

// ─── Hooks factory ─────────────────────────────────────────────────────────────

/**
 * Create admin access request hooks bound to an ApiClient.
 */
export function useAdminAccessRequests(client: ApiClient, params?: AccessRequestsParams) {
  const queryClient = useQueryClient();

  const queryString = new URLSearchParams();
  if (params?.status) queryString.set('status', params.status);
  if (params?.limit !== undefined) queryString.set('limit', String(params.limit));
  if (params?.offset !== undefined) queryString.set('offset', String(params.offset));
  const qs = queryString.toString();

  const list = useQuery<AccessRequestsResponse>({
    queryKey: ['admin', 'access-requests', params],
    queryFn: async () => {
      const res = await client.get<AccessRequestsResponse>(`/access/requests${qs ? `?${qs}` : ''}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.post<AccessRequest>(`/access/requests/${id}/approve`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access-requests'] });
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const res = await client.post<AccessRequest>(`/access/requests/${id}/reject`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'access-requests'] });
    },
  });

  return { list, approve, reject };
}
