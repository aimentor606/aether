import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StatelessFlusher {
  runs: number;
  pending: number;
  running: number;
}

export interface StatelessOwnership {
  worker_id: string;
  owned: number;
  running: number;
  run_ids: string[];
}

export interface StatelessRecovery {
  running: boolean;
  callbacks: number;
  sharded: boolean;
  shard_id: number;
  total_shards: number;
}

export interface StatelessHealth {
  healthy: boolean;
  ready: boolean;
  initialized: boolean;
  shutting_down: boolean;
  flusher: StatelessFlusher;
  ownership: StatelessOwnership;
  recovery: StatelessRecovery;
}

export interface StatelessAlert {
  level: 'info' | 'warning' | 'error' | 'critical';
  metric: string;
  value: string | number;
}

export interface StatelessWAL {
  total_pending: number;
  runs_with_pending: number;
  local_buffer_runs: number;
}

export interface StatelessDLQ {
  total_entries: number;
  unique_runs: number;
  by_type: Record<string, number>;
  oldest_entry_age: string;
}

export interface StatelessDashboard {
  active_runs: number;
  active_runs_metric: number;
  owned_runs: number;
  pending_writes: number;
  stuck_count: number;
  runs_started: number;
  runs_completed: number;
  runs_failed: number;
  runs_recovered: number;
  runs_rejected: number;
  flush_latency_avg: number;
  flush_latency_p99: number;
  wal: StatelessWAL;
  dlq: StatelessDLQ;
  healthy: boolean;
  alerts: StatelessAlert[];
}

export interface StuckRun {
  run_id: string;
  stuck_for: string;
  status: string;
  last_step?: string;
}

export interface DLQEntry {
  id: string;
  run_id: string;
  type: string;
  error: string;
  created_at: string;
  payload?: Record<string, unknown>;
}

export interface RecoveryResponse {
  recovered: number;
  message: string;
}

export interface CircuitBreaker {
  name: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  last_failure?: string;
  reset_at?: string;
}

export interface Backpressure {
  active: boolean;
  level: number;
  reason?: string;
}

export interface SweepResult {
  swept: number;
  recovered: number;
  failed: number;
}

export interface FlushResult {
  flushed: number;
  failed: number;
  latency_ms: number;
}

export interface RateLimiterStats {
  name: string;
  tokens_remaining: number;
  max_tokens: number;
  refill_rate: number;
}

export interface RunInfo {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  steps_completed: number;
  steps_total: number;
  metadata?: Record<string, unknown>;
}

export interface MetricsSnapshot {
  timestamp: string;
  active_runs: number;
  pending_writes: number;
  flush_latency_avg: number;
  flush_latency_p99: number;
}

export interface MetricsHistory {
  snapshots: MetricsSnapshot[];
}

// ─── Options ────────────────────────────────────────────────────────────────────

export interface AdminStatelessOptions {
  stuckMinAge?: number;
  dlqCount?: number;
  dlqRunId?: string;
  metricsMinutes?: number;
  runLookupId?: string | null;
}

// ─── Hook factory ───────────────────────────────────────────────────────────────

const QUERY_KEY = 'admin-stateless';

/**
 * Create admin stateless hooks bound to an ApiClient.
 */
export function useAdminStateless(client: ApiClient, opts: AdminStatelessOptions = {}) {
  const queryClient = useQueryClient();
  const invalidate = (keys: string[]) =>
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, ...keys] });

  // ─── Queries ─────────────────────────────────────────────────────────────

  const health = useQuery<StatelessHealth>({
    queryKey: [QUERY_KEY, 'health'],
    queryFn: async () => {
      const res = await client.get<StatelessHealth>('/admin/stateless/health');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const dashboard = useQuery<StatelessDashboard>({
    queryKey: [QUERY_KEY, 'dashboard'],
    queryFn: async () => {
      const res = await client.get<StatelessDashboard>('/admin/stateless/dashboard');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const stuckRuns = useQuery<StuckRun[]>({
    queryKey: [QUERY_KEY, 'stuck', opts.stuckMinAge],
    queryFn: async () => {
      const params = opts.stuckMinAge ? `?min_age=${opts.stuckMinAge}` : '';
      const res = await client.get<StuckRun[]>(`/admin/stateless/stuck${params}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const dlq = useQuery<DLQEntry[]>({
    queryKey: [QUERY_KEY, 'dlq', opts.dlqCount, opts.dlqRunId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (opts.dlqCount) params.set('count', String(opts.dlqCount));
      if (opts.dlqRunId) params.set('run_id', opts.dlqRunId);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await client.get<DLQEntry[]>(`/admin/stateless/dlq/entries${qs}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const walStats = useQuery<unknown>({
    queryKey: [QUERY_KEY, 'wal'],
    queryFn: async () => {
      const res = await client.get('/admin/stateless/wal/stats');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const circuitBreakers = useQuery<CircuitBreaker[]>({
    queryKey: [QUERY_KEY, 'circuit-breakers'],
    queryFn: async () => {
      const res = await client.get<CircuitBreaker[]>('/admin/stateless/circuit-breakers');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const backpressure = useQuery<Backpressure>({
    queryKey: [QUERY_KEY, 'backpressure'],
    queryFn: async () => {
      const res = await client.get<Backpressure>('/admin/stateless/backpressure');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
  });

  const rateLimiters = useQuery<RateLimiterStats[]>({
    queryKey: [QUERY_KEY, 'rate-limiters'],
    queryFn: async () => {
      const res = await client.get<RateLimiterStats[]>('/admin/stateless/rate-limiters');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const runLookup = useQuery<RunInfo>({
    queryKey: [QUERY_KEY, 'run', opts.runLookupId],
    queryFn: async () => {
      const res = await client.get<RunInfo>(`/admin/stateless/run/${opts.runLookupId}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    enabled: !!opts.runLookupId && opts.runLookupId.length >= 8,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  const metricsHistory = useQuery<MetricsHistory>({
    queryKey: [QUERY_KEY, 'metrics', 'history', opts.metricsMinutes],
    queryFn: async () => {
      const params = opts.metricsMinutes ? `?minutes=${opts.metricsMinutes}` : '';
      const res = await client.get<MetricsHistory>(`/admin/stateless/metrics/history${params}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const sweep = useMutation({
    mutationFn: async () => {
      const res = await client.post<SweepResult>('/admin/stateless/sweep');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dashboard', 'stuck']);
    },
  });

  const flush = useMutation({
    mutationFn: async () => {
      const res = await client.post<FlushResult>('/admin/stateless/flush');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dashboard', 'wal']);
    },
  });

  const forceResume = useMutation({
    mutationFn: async (runId: string) => {
      const res = await client.post<RecoveryResponse>(`/admin/stateless/resume/${runId}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dashboard', 'stuck']);
    },
  });

  const forceComplete = useMutation({
    mutationFn: async ({ runId, reason }: { runId: string; reason?: string }) => {
      const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
      const res = await client.post<RecoveryResponse>(`/admin/stateless/complete/${runId}${params}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dashboard', 'stuck']);
    },
  });

  const forceFail = useMutation({
    mutationFn: async (runId: string) => {
      const res = await client.post<RecoveryResponse>(`/admin/stateless/fail/${runId}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dashboard', 'stuck']);
    },
  });

  const dlqRetry = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await client.post<RecoveryResponse>(`/admin/stateless/dlq/retry/${entryId}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dlq', 'dashboard']);
    },
  });

  const dlqDelete = useMutation({
    mutationFn: async (entryId: string) => {
      const res = await client.delete(`/admin/stateless/dlq/${entryId}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dlq', 'dashboard']);
    },
  });

  const dlqPurge = useMutation({
    mutationFn: async (olderThanHours?: number) => {
      const params = olderThanHours ? `?older_than_hours=${olderThanHours}` : '';
      const res = await client.post<RecoveryResponse>(`/admin/stateless/dlq/purge${params}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['dlq', 'dashboard']);
    },
  });

  const resetCircuitBreakers = useMutation({
    mutationFn: async () => {
      const res = await client.post<RecoveryResponse>('/admin/stateless/circuit-breakers/reset');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['circuit-breakers']);
    },
  });

  return {
    // queries
    health,
    dashboard,
    stuckRuns,
    dlq,
    walStats,
    circuitBreakers,
    backpressure,
    rateLimiters,
    runLookup,
    metricsHistory,
    // mutations
    sweep,
    flush,
    forceResume,
    forceComplete,
    forceFail,
    dlqRetry,
    dlqDelete,
    dlqPurge,
    resetCircuitBreakers,
  };
}
