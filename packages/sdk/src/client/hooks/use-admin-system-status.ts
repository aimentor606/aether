import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface MaintenanceNotice {
  enabled: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface TechnicalIssue {
  enabled: boolean;
  message?: string | null;
  status_url?: string | null;
  affected_services?: string[] | null;
  description?: string | null;
  estimated_resolution?: string | null;
  severity?: 'degraded' | 'outage' | 'maintenance' | null;
}

export interface SystemStatus {
  maintenance_notice: MaintenanceNotice;
  technical_issue: TechnicalIssue;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface UpdateMaintenanceRequest {
  enabled: boolean;
  start_time?: string | null;
  end_time?: string | null;
}

export interface UpdateTechnicalIssueRequest {
  enabled: boolean;
  message?: string | null;
  status_url?: string | null;
  affected_services?: string[] | null;
  description?: string | null;
  estimated_resolution?: string | null;
  severity?: 'degraded' | 'outage' | 'maintenance' | null;
}

const DEFAULT_SYSTEM_STATUS: SystemStatus = {
  maintenance_notice: { enabled: false },
  technical_issue: { enabled: false },
  updated_at: '',
  updated_by: '',
};

// ─── Hooks factory ─────────────────────────────────────────────────────────────

/**
 * Create admin system status hooks bound to an ApiClient.
 */
export function useAdminSystemStatus(client: ApiClient) {
  const queryClient = useQueryClient();

  const status = useQuery<SystemStatus>({
    queryKey: ['admin-system-status'],
    queryFn: async () => {
      const res = await client.get<SystemStatus>('/admin/system-status');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
    placeholderData: DEFAULT_SYSTEM_STATUS,
  });

  const updateMaintenance = useMutation({
    mutationFn: async (data: UpdateMaintenanceRequest) => {
      const res = await client.put<SystemStatus>('/admin/system-status/maintenance', data);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-system-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  const updateTechnicalIssue = useMutation({
    mutationFn: async (data: UpdateTechnicalIssueRequest) => {
      const res = await client.put<SystemStatus>('/admin/system-status/technical-issue', data);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-system-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      const res = await client.delete<SystemStatus>('/admin/system-status');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-system-status'] });
      queryClient.invalidateQueries({ queryKey: ['system-status'] });
    },
  });

  return { status, updateMaintenance, updateTechnicalIssue, clear };
}
