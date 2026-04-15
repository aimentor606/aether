import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AnalyticsSource = 'live' | 'demo' | 'all';

export interface AnalyticsSummary {
  total_threads: number;
  total_messages: number;
  active_users: number;
  avg_messages_per_thread: number;
  total_revenue: number;
  mrr: number;
  arr: number;
}

export interface ThreadAnalytics {
  thread_id: string;
  platform: Platform;
  created_at: string;
  updated_at: string;
  message_count: number;
  category?: string;
  tier?: string;
  metadata?: Record<string, unknown>;
}

export interface RetentionData {
  cohort: string;
  period: string;
  total_users: number;
  retained: number;
  retention_rate: number;
}

export interface MessageDistribution {
  by_platform: Record<Platform, number>;
  by_category: Record<string, number>;
  by_hour: Record<number, number>;
  by_day: Record<string, number>;
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
}

export interface TierDistribution {
  tier: string;
  count: number;
  percentage: number;
  revenue: number;
}

export interface VisitorStats {
  total_visitors: number;
  unique_visitors: number;
  returning_visitors: number;
  avg_session_duration: number;
  bounce_rate: number;
  by_source: Record<string, number>;
}

export interface ConversionFunnel {
  step: string;
  count: number;
  drop_off: number;
  conversion_rate: number;
}

export interface TranslationResponse {
  translated_text: string;
  source_language: string;
  target_language: string;
}

export interface ThreadBrowseParams {
  page?: number;
  limit?: number;
  platform?: Platform;
  category?: string;
  tier?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface RetentionParams {
  period: 'daily' | 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
  cohort_size?: number;
}

export interface FieldOverrides {
  [field: string]: {
    overridden: boolean;
    value: unknown;
    source: string;
  };
}

export type Platform = 'web' | 'ios' | 'android' | 'api' | 'cli' | 'slack' | 'discord' | 'teams';

export interface WeeklyActualData {
  week_start: string;
  week_end: string;
  mrr: number;
  arr: number;
  new_mrr: number;
  churned_mrr: number;
  net_new_mrr: number;
}

export interface WeeklyActualsResponse {
  data: WeeklyActualData[];
  total_weeks: number;
}

export interface MonthlyActualData {
  month: string;
  mrr: number;
  arr: number;
  new_mrr: number;
  churned_mrr: number;
  net_new_mrr: number;
  customers: number;
}

export interface MonthlyActualsResponse {
  data: MonthlyActualData[];
  total_months: number;
}

export interface SimulatorConfigData {
  current_mrr: number;
  growth_rate_monthly: number;
  churn_rate_monthly: number;
  expansion_rate_monthly: number;
  projection_months: number;
  custom_assumptions: Record<string, unknown>;
}

export interface SignupsByDateResponse {
  data: Array<{ date: string; count: number }>;
  total: number;
}

export interface ViewsByDateResponse {
  data: Array<{ date: string; count: number; unique: number }>;
  total: number;
}

export interface NewPaidByDateResponse {
  data: Array<{ date: string; count: number; revenue: number }>;
  total: number;
}

export interface ChurnByDateResponse {
  data: Array<{ date: string; count: number; lost_revenue: number }>;
  total: number;
}

export interface RevenueSummary {
  total_revenue: number;
  mrr: number;
  arr: number;
  arr_growth_rate: number;
  average_revenue_per_user: number;
  lifetime_value: number;
  by_tier: Record<string, { revenue: number; customers: number }>;
}

export interface EngagementSummary {
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  avg_sessions_per_day: number;
  avg_messages_per_session: number;
  median_response_time_ms: number;
}

export interface TaskPerformance {
  task_type: string;
  total: number;
  successful: number;
  failed: number;
  avg_duration_ms: number;
  p99_duration_ms: number;
}

export interface ToolUsage {
  tool_name: string;
  total_calls: number;
  successful: number;
  failed: number;
  avg_duration_ms: number;
}

export interface ToolAdoptionSummary {
  tools: ToolUsage[];
  total_calls: number;
  success_rate: number;
  avg_duration_ms: number;
}

export interface TierProfitability {
  tier: string;
  customers: number;
  revenue: number;
  costs: number;
  margin: number;
  margin_percentage: number;
}

export interface ProfitabilitySummary {
  tiers: TierProfitability[];
  total_revenue: number;
  total_costs: number;
  total_margin: number;
  total_margin_percentage: number;
}

// ─── Mutation param types ───────────────────────────────────────────────────────

export interface UpdateWeeklyActualParams {
  week_start: string;
  data: Partial<Omit<WeeklyActualData, 'week_start' | 'week_end'>>;
}

export interface DeleteWeeklyActualParams {
  week_start: string;
}

export interface ToggleFieldOverrideParams {
  field: string;
  enabled: boolean;
  value?: unknown;
}

export interface UpdateSimulatorConfigParams {
  config: Partial<SimulatorConfigData>;
}

export interface UpdateMonthlyActualParams {
  month: string;
  data: Partial<Omit<MonthlyActualData, 'month'>>;
}

export interface DeleteMonthlyActualParams {
  month: string;
}

export interface ToggleMonthlyFieldOverrideParams {
  field: string;
  enabled: boolean;
  value?: unknown;
}

export interface TranslateParams {
  text: string;
  target_language: string;
  source_language?: string;
}

// ─── Hook factory ───────────────────────────────────────────────────────────────

const QUERY_KEY = 'admin-analytics';

/**
 * Create admin analytics hooks bound to an ApiClient.
 */
export function useAdminAnalytics(client: ApiClient) {
  const queryClient = useQueryClient();
  const invalidate = (keys: string[]) =>
    queryClient.invalidateQueries({ queryKey: [QUERY_KEY, ...keys] });

  // ─── Summary ─────────────────────────────────────────────────────────────

  const summary = useQuery<AnalyticsSummary>({
    queryKey: [QUERY_KEY, 'summary'],
    queryFn: async () => {
      const res = await client.get<AnalyticsSummary>('/admin/analytics/summary');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  // ─── Thread Browser ──────────────────────────────────────────────────────

  const threadBrowser = (params: ThreadBrowseParams = {}) =>
    useQuery<{ threads: ThreadAnalytics[]; total: number }>({
      queryKey: [QUERY_KEY, 'threads', params],
      queryFn: async () => {
        const qs = new URLSearchParams();
        if (params.page) qs.set('page', String(params.page));
        if (params.limit) qs.set('limit', String(params.limit));
        if (params.platform) qs.set('platform', params.platform);
        if (params.category) qs.set('category', params.category);
        if (params.tier) qs.set('tier', params.tier);
        if (params.search) qs.set('search', params.search);
        if (params.sort_by) qs.set('sort_by', params.sort_by);
        if (params.sort_order) qs.set('sort_order', params.sort_order);
        const query = qs.toString() ? `?${qs.toString()}` : '';
        const res = await client.get<{ threads: ThreadAnalytics[]; total: number }>(
          `/admin/analytics/threads${query}`,
        );
        if (res.error) throw new Error(res.error);
        return res.data!;
      },
      staleTime: 120_000,
      placeholderData: (prev) => prev,
    });

  // ─── Distributions ───────────────────────────────────────────────────────

  const messageDistribution = useQuery<MessageDistribution>({
    queryKey: [QUERY_KEY, 'message-distribution'],
    queryFn: async () => {
      const res = await client.get<MessageDistribution>('/admin/analytics/messages/distribution');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const categoryDistribution = useQuery<CategoryDistribution[]>({
    queryKey: [QUERY_KEY, 'category-distribution'],
    queryFn: async () => {
      const res = await client.get<CategoryDistribution[]>('/admin/analytics/categories/distribution');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const tierDistribution = useQuery<TierDistribution[]>({
    queryKey: [QUERY_KEY, 'tier-distribution'],
    queryFn: async () => {
      const res = await client.get<TierDistribution[]>('/admin/analytics/tiers/distribution');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  // ─── Visitors & Funnel ───────────────────────────────────────────────────

  const visitorStats = useQuery<VisitorStats>({
    queryKey: [QUERY_KEY, 'visitors'],
    queryFn: async () => {
      const res = await client.get<VisitorStats>('/admin/analytics/visitors');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const conversionFunnel = useQuery<ConversionFunnel[]>({
    queryKey: [QUERY_KEY, 'conversion-funnel'],
    queryFn: async () => {
      const res = await client.get<ConversionFunnel[]>('/admin/analytics/conversion-funnel');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 180_000,
    placeholderData: (prev) => prev,
  });

  // ─── Retention ───────────────────────────────────────────────────────────

  const retentionData = (params: RetentionParams) =>
    useQuery<RetentionData[]>({
      queryKey: [QUERY_KEY, 'retention', params],
      queryFn: async () => {
        const qs = new URLSearchParams();
        qs.set('period', params.period);
        if (params.start_date) qs.set('start_date', params.start_date);
        if (params.end_date) qs.set('end_date', params.end_date);
        if (params.cohort_size) qs.set('cohort_size', String(params.cohort_size));
        const res = await client.get<RetentionData[]>(
          `/admin/analytics/retention?${qs.toString()}`,
        );
        if (res.error) throw new Error(res.error);
        return res.data!;
      },
      staleTime: 300_000,
      placeholderData: (prev) => prev,
    });

  // ─── ARR & Financial ─────────────────────────────────────────────────────

  const arrWeeklyActuals = useQuery<WeeklyActualsResponse>({
    queryKey: [QUERY_KEY, 'arr', 'weekly-actuals'],
    queryFn: async () => {
      const res = await client.get<WeeklyActualsResponse>('/admin/analytics/arr/weekly-actuals');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const arrMonthlyActuals = useQuery<MonthlyActualsResponse>({
    queryKey: [QUERY_KEY, 'arr', 'monthly-actuals'],
    queryFn: async () => {
      const res = await client.get<MonthlyActualsResponse>('/admin/analytics/arr/monthly-actuals');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const arrSimulatorConfig = useQuery<SimulatorConfigData>({
    queryKey: [QUERY_KEY, 'arr', 'simulator-config'],
    queryFn: async () => {
      const res = await client.get<SimulatorConfigData>('/admin/analytics/arr/simulator-config');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 300_000,
    placeholderData: (prev) => prev,
  });

  // ─── Date-based Metrics ──────────────────────────────────────────────────

  const signupsByDate = useQuery<SignupsByDateResponse>({
    queryKey: [QUERY_KEY, 'signups'],
    queryFn: async () => {
      const res = await client.get<SignupsByDateResponse>('/admin/analytics/signups');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const viewsByDate = useQuery<ViewsByDateResponse>({
    queryKey: [QUERY_KEY, 'views'],
    queryFn: async () => {
      const res = await client.get<ViewsByDateResponse>('/admin/analytics/views');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const newPaidByDate = useQuery<NewPaidByDateResponse>({
    queryKey: [QUERY_KEY, 'new-paid'],
    queryFn: async () => {
      const res = await client.get<NewPaidByDateResponse>('/admin/analytics/new-paid');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const churnByDate = useQuery<ChurnByDateResponse>({
    queryKey: [QUERY_KEY, 'churn'],
    queryFn: async () => {
      const res = await client.get<ChurnByDateResponse>('/admin/analytics/churn');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  // ─── Revenue & Engagement ────────────────────────────────────────────────

  const revenueSummary = useQuery<RevenueSummary>({
    queryKey: [QUERY_KEY, 'revenue'],
    queryFn: async () => {
      const res = await client.get<RevenueSummary>('/admin/analytics/revenue');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 180_000,
    placeholderData: (prev) => prev,
  });

  const engagementSummary = useQuery<EngagementSummary>({
    queryKey: [QUERY_KEY, 'engagement'],
    queryFn: async () => {
      const res = await client.get<EngagementSummary>('/admin/analytics/engagement');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  // ─── Task & Tool Performance ─────────────────────────────────────────────

  const taskPerformance = useQuery<TaskPerformance[]>({
    queryKey: [QUERY_KEY, 'task-performance'],
    queryFn: async () => {
      const res = await client.get<TaskPerformance[]>('/admin/analytics/tasks/performance');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  const toolAdoption = useQuery<ToolAdoptionSummary>({
    queryKey: [QUERY_KEY, 'tool-adoption'],
    queryFn: async () => {
      const res = await client.get<ToolAdoptionSummary>('/admin/analytics/tools/adoption');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 120_000,
    placeholderData: (prev) => prev,
  });

  // ─── Profitability ───────────────────────────────────────────────────────

  const profitability = useQuery<ProfitabilitySummary>({
    queryKey: [QUERY_KEY, 'profitability'],
    queryFn: async () => {
      const res = await client.get<ProfitabilitySummary>('/admin/analytics/profitability');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 180_000,
    placeholderData: (prev) => prev,
  });

  // ─── Mutations ───────────────────────────────────────────────────────────

  const updateARRWeeklyActual = useMutation({
    mutationFn: async (params: UpdateWeeklyActualParams) => {
      const res = await client.put<WeeklyActualData>(
        `/admin/analytics/arr/weekly-actuals/${params.week_start}`,
        params.data,
      );
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr', 'weekly-actuals']);
    },
  });

  const deleteARRWeeklyActual = useMutation({
    mutationFn: async (params: DeleteWeeklyActualParams) => {
      const res = await client.delete(`/admin/analytics/arr/weekly-actuals/${params.week_start}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr', 'weekly-actuals']);
    },
  });

  const toggleFieldOverride = useMutation({
    mutationFn: async (params: ToggleFieldOverrideParams) => {
      const res = await client.post<FieldOverrides>(
        '/admin/analytics/arr/field-overrides/toggle',
        params,
      );
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr']);
    },
  });

  const updateARRSimulatorConfig = useMutation({
    mutationFn: async (params: UpdateSimulatorConfigParams) => {
      const res = await client.put<SimulatorConfigData>(
        '/admin/analytics/arr/simulator-config',
        params.config,
      );
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr', 'simulator-config']);
    },
  });

  const updateARRMonthlyActual = useMutation({
    mutationFn: async (params: UpdateMonthlyActualParams) => {
      const res = await client.put<MonthlyActualData>(
        `/admin/analytics/arr/monthly-actuals/${params.month}`,
        params.data,
      );
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr', 'monthly-actuals']);
    },
  });

  const deleteARRMonthlyActual = useMutation({
    mutationFn: async (params: DeleteMonthlyActualParams) => {
      const res = await client.delete(`/admin/analytics/arr/monthly-actuals/${params.month}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr', 'monthly-actuals']);
    },
  });

  const toggleMonthlyFieldOverride = useMutation({
    mutationFn: async (params: ToggleMonthlyFieldOverrideParams) => {
      const res = await client.post<FieldOverrides>(
        '/admin/analytics/arr/monthly-field-overrides/toggle',
        params,
      );
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    onSuccess: () => {
      invalidate(['arr']);
    },
  });

  const translate = useMutation({
    mutationFn: async (params: TranslateParams) => {
      const res = await client.post<TranslationResponse>(
        '/admin/analytics/translate',
        params,
      );
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
  });

  return {
    // queries
    summary,
    threadBrowser,
    messageDistribution,
    categoryDistribution,
    tierDistribution,
    visitorStats,
    conversionFunnel,
    retentionData,
    arrWeeklyActuals,
    arrMonthlyActuals,
    arrSimulatorConfig,
    signupsByDate,
    viewsByDate,
    newPaidByDate,
    churnByDate,
    revenueSummary,
    engagementSummary,
    taskPerformance,
    toolAdoption,
    profitability,
    // mutations
    updateARRWeeklyActual,
    deleteARRWeeklyActual,
    toggleFieldOverride,
    updateARRSimulatorConfig,
    updateARRMonthlyActual,
    deleteARRMonthlyActual,
    toggleMonthlyFieldOverride,
    translate,
  };
}
