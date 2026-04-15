import { useState, useCallback, useRef } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface StressTestConfig {
  concurrent_threads: number;
  total_requests: number;
  ramp_up_seconds: number;
  request_config: {
    platform: string;
    message: string;
    thread_id?: string;
    metadata?: Record<string, unknown>;
  };
}

export interface TimingBreakdownStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

export interface StressTestResult {
  request_id: string;
  thread_id: string;
  status: 'success' | 'error';
  total_time_ms: number;
  queue_time_ms?: number;
  first_token_time_ms?: number;
  completion_time_ms?: number;
  error?: string;
  timestamp: string;
}

export interface StressTestSummary {
  total_requests: number;
  successful: number;
  failed: number;
  total_time_ms: number;
  requests_per_second: number;
  error_rate: number;
  total_time_stats: TimingBreakdownStats;
  queue_time_stats?: TimingBreakdownStats;
  first_token_stats?: TimingBreakdownStats;
  completion_time_stats?: TimingBreakdownStats;
  errors_by_type: Record<string, number>;
}

export interface StressTestState {
  status: 'idle' | 'running' | 'completed' | 'error';
  config: StressTestConfig | null;
  results: StressTestResult[];
  summary: StressTestSummary | null;
  progress: number;
  error: string | null;
}

type SSEEventType = 'config' | 'batch_start' | 'status' | 'result' | 'summary';

interface SSEEvent {
  type: SSEEventType;
  data: unknown;
}

// ─── Hook ───────────────────────────────────────────────────────────────────────

const INITIAL_STATE: StressTestState = {
  status: 'idle',
  config: null,
  results: [],
  summary: null,
  progress: 0,
  error: null,
};

/**
 * Custom hook for running stress tests with SSE streaming.
 *
 * This hook does NOT use ApiClient because stress tests use Server-Sent Events
 * for real-time streaming. It requires direct access to the API base URL and
 * an auth token provider.
 */
export function useAdminStressTest(
  apiBaseUrl: string,
  getAuthToken: () => Promise<string | null>,
) {
  const [state, setState] = useState<StressTestState>({ ...INITIAL_STATE });
  const abortControllerRef = useRef<AbortController | null>(null);

  const runStressTest = useCallback(
    async (config: StressTestConfig) => {
      // Cancel any existing test
      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState({
        status: 'running',
        config,
        results: [],
        summary: null,
        progress: 0,
        error: null,
      });

      try {
        const token = await getAuthToken();
        const response = await fetch(`${apiBaseUrl}/admin/stress-test/run`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(config),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: SSEEvent = JSON.parse(line.slice(6));
                processEvent(event);
              } catch {
                // Skip malformed events
              }
            }
          }
        }

        // Process any remaining data in buffer
        if (buffer.startsWith('data: ')) {
          try {
            const event: SSEEvent = JSON.parse(buffer.slice(6));
            processEvent(event);
          } catch {
            // Skip malformed events
          }
        }

        setState((prev) => ({
          ...prev,
          status: prev.status === 'running' ? 'completed' : prev.status,
        }));
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // Cancelled, don't update state
        }
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }

      function processEvent(event: SSEEvent) {
        switch (event.type) {
          case 'config':
            setState((prev) => ({
              ...prev,
              config: event.data as StressTestConfig,
            }));
            break;

          case 'batch_start':
            // Batch started, no state change needed
            break;

          case 'status': {
            const statusData = event.data as { completed: number; total: number };
            setState((prev) => ({
              ...prev,
              progress: statusData.total > 0
                ? (statusData.completed / statusData.total) * 100
                : prev.progress,
            }));
            break;
          }

          case 'result':
            setState((prev) => ({
              ...prev,
              results: [...prev.results, event.data as StressTestResult],
            }));
            break;

          case 'summary':
            setState((prev) => ({
              ...prev,
              summary: event.data as StressTestSummary,
            }));
            break;
        }
      }
    },
    [apiBaseUrl, getAuthToken],
  );

  const cancelTest = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState((prev) => ({
      ...prev,
      status: prev.status === 'running' ? 'idle' : prev.status,
    }));
  }, []);

  const resetTest = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setState({ ...INITIAL_STATE });
  }, []);

  return { state, runStressTest, cancelTest, resetTest };
}
