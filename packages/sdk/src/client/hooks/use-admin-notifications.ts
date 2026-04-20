import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Workflow {
  workflow_id: string;
  name: string;
  description?: string;
  active: boolean;
  tags?: string[];
}

export interface WorkflowsResponse {
  success: boolean;
  workflows: Workflow[];
  total: number;
}

export interface TriggerWorkflowRequest {
  workflow_id: string;
  payload?: Record<string, unknown>;
  subscriber_id?: string;
  subscriber_email?: string;
  broadcast?: boolean;
}

export interface TriggerWorkflowResult {
  success: boolean;
  message: string;
  broadcast?: boolean;
  response?: Record<string, unknown>;
  subscriber_id?: string;
  result?: Record<string, unknown>;
}

// ─── Hooks factory ─────────────────────────────────────────────────────────────

/**
 * Create admin notification hooks bound to an ApiClient.
 */
export function useAdminNotifications(client: ApiClient) {
  const queryClient = useQueryClient();

  const workflows = useQuery<WorkflowsResponse>({
    queryKey: ['admin', 'notifications', 'workflows'],
    queryFn: async () => {
      const res = await client.get<WorkflowsResponse>('/admin/notifications/workflows');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5 * 60_000,
  });

  const triggerWorkflow = useMutation({
    mutationFn: async (data: TriggerWorkflowRequest) => {
      const res = await client.post<TriggerWorkflowResult>('/admin/notifications/trigger-workflow', data);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'notifications'] });
    },
  });

  return { workflows, triggerWorkflow };
}
