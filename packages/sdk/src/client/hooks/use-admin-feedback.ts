import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface FeedbackWithUser {
  id: string;
  rating: number;
  text?: string;
  category?: string;
  page_url?: string;
  user_agent?: string;
  created_at: string;
  user_id?: string;
  user_email?: string;
  user_name?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface FeedbackListResponse {
  data: FeedbackWithUser[];
  pagination: PaginationMeta;
}

export interface FeedbackListParams {
  page?: number;
  page_size?: number;
  rating_filter?: number;
  has_text?: boolean;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FeedbackStats {
  total_feedback: number;
  average_rating: number;
  rating_distribution: Record<number, number>;
}

export interface SentimentSummary {
  positive: number;
  neutral: number;
  negative: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
  average_rating: number;
}

export interface RatingTrends {
  trends: TimeSeriesPoint[];
}

export interface CriticalFeedback {
  id: string;
  rating: number;
  text: string;
  created_at: string;
  user_email?: string;
}

export interface ImprovementArea {
  area: string;
  count: number;
  sentiment: string;
}

export interface ActionableRecommendation {
  recommendation: string;
  priority: string;
  impact: string;
}

export interface LLMAnalysisResponse {
  analysis: string;
  key_themes: string[];
  improvement_areas: ImprovementArea[];
  positive_highlights: string[];
  actionable_recommendations: ActionableRecommendation[];
  feedback_analyzed_count: number;
  generated_at: string;
}

export interface LLMAnalysisRequest {
  focus_area?: string;
  days?: number;
  max_feedback?: number;
}

export interface TimeSeriesParams {
  days?: number;
  granularity?: 'day' | 'week' | 'month';
}

export interface RatingTrendsParams {
  days?: number;
}

export interface CriticalFeedbackParams {
  limit?: number;
}

export interface ExportParams {
  format?: 'csv' | 'json';
  start_date?: string;
  end_date?: string;
  rating_filter?: number;
}

// ─── Hooks factory ─────────────────────────────────────────────────────────────

/**
 * Create admin feedback hooks bound to an ApiClient.
 */
export function useAdminFeedback(client: ApiClient, params?: FeedbackListParams) {
  const queryClient = useQueryClient();

  // ─── List ────────────────────────────────────────────────────────────────

  const listQueryString = new URLSearchParams();
  if (params?.page !== undefined) listQueryString.set('page', String(params.page));
  if (params?.page_size !== undefined) listQueryString.set('page_size', String(params.page_size));
  if (params?.rating_filter !== undefined) listQueryString.set('rating_filter', String(params.rating_filter));
  if (params?.has_text !== undefined) listQueryString.set('has_text', String(params.has_text));
  if (params?.sort_by) listQueryString.set('sort_by', params.sort_by);
  if (params?.sort_order) listQueryString.set('sort_order', params.sort_order);
  const listQs = listQueryString.toString();

  const list = useQuery<FeedbackListResponse>({
    queryKey: ['admin', 'feedback', 'list', params],
    queryFn: async () => {
      const res = await client.get<FeedbackListResponse>(`/admin/feedback/list${listQs ? `?${listQs}` : ''}`);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 30_000,
  });

  // ─── Stats ───────────────────────────────────────────────────────────────

  const stats = useQuery<FeedbackStats>({
    queryKey: ['admin', 'feedback', 'stats'],
    queryFn: async () => {
      const res = await client.get<FeedbackStats>('/admin/feedback/stats');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5 * 60_000,
  });

  // ─── Sentiment ───────────────────────────────────────────────────────────

  const sentiment = useQuery<SentimentSummary>({
    queryKey: ['admin', 'feedback', 'sentiment'],
    queryFn: async () => {
      const res = await client.get<SentimentSummary>('/admin/feedback/sentiment');
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
    staleTime: 5 * 60_000,
  });

  // ─── Time Series ─────────────────────────────────────────────────────────

  const timeSeries = (tsParams?: TimeSeriesParams) =>
    useQuery<TimeSeriesPoint[]>({
      queryKey: ['admin', 'feedback', 'time-series', tsParams],
      queryFn: async () => {
        const qs = new URLSearchParams();
        if (tsParams?.days !== undefined) qs.set('days', String(tsParams.days));
        if (tsParams?.granularity) qs.set('granularity', tsParams.granularity);
        const qsStr = qs.toString();
        const res = await client.get<TimeSeriesPoint[]>(`/admin/feedback/time-series${qsStr ? `?${qsStr}` : ''}`);
        if (res.error) throw new Error(res.error);
        return res.data!;
      },
      staleTime: 5 * 60_000,
    });

  // ─── Rating Trends ───────────────────────────────────────────────────────

  const ratingTrends = (trendsParams?: RatingTrendsParams) =>
    useQuery<RatingTrends>({
      queryKey: ['admin', 'feedback', 'rating-trends', trendsParams],
      queryFn: async () => {
        const qs = new URLSearchParams();
        if (trendsParams?.days !== undefined) qs.set('days', String(trendsParams.days));
        const qsStr = qs.toString();
        const res = await client.get<RatingTrends>(`/admin/feedback/rating-trends${qsStr ? `?${qsStr}` : ''}`);
        if (res.error) throw new Error(res.error);
        return res.data!;
      },
      staleTime: 5 * 60_000,
    });

  // ─── Critical Feedback ───────────────────────────────────────────────────

  const critical = (criticalParams?: CriticalFeedbackParams) =>
    useQuery<CriticalFeedback[]>({
      queryKey: ['admin', 'feedback', 'critical', criticalParams],
      queryFn: async () => {
        const qs = new URLSearchParams();
        if (criticalParams?.limit !== undefined) qs.set('limit', String(criticalParams.limit));
        const qsStr = qs.toString();
        const res = await client.get<CriticalFeedback[]>(`/admin/feedback/critical${qsStr ? `?${qsStr}` : ''}`);
        if (res.error) throw new Error(res.error);
        return res.data!;
      },
      staleTime: 60_000,
    });

  // ─── Export ──────────────────────────────────────────────────────────────

  const exportData = (exportParams?: ExportParams) =>
    useQuery<Blob>({
      queryKey: ['admin', 'feedback', 'export', exportParams],
      queryFn: async () => {
        const qs = new URLSearchParams();
        if (exportParams?.format) qs.set('format', exportParams.format);
        if (exportParams?.start_date) qs.set('start_date', exportParams.start_date);
        if (exportParams?.end_date) qs.set('end_date', exportParams.end_date);
        if (exportParams?.rating_filter !== undefined) qs.set('rating_filter', String(exportParams.rating_filter));
        const qsStr = qs.toString();
        const res = await client.get<Blob>(`/admin/feedback/export${qsStr ? `?${qsStr}` : ''}`);
        if (res.error) throw new Error(res.error);
        return res.data!;
      },
      enabled: false,
    });

  // ─── Analysis ────────────────────────────────────────────────────────────

  const analysis = useMutation({
    mutationFn: async (data: LLMAnalysisRequest) => {
      const res = await client.post<LLMAnalysisResponse>('/admin/feedback/analyze', data);
      if (res.error) throw new Error(res.error);
      return res.data!;
    },
  });

  // ─── Refresh ─────────────────────────────────────────────────────────────

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'feedback'] });
  };

  return {
    list,
    stats,
    sentiment,
    timeSeries,
    ratingTrends,
    critical,
    exportData,
    analysis,
    refresh,
  };
}
