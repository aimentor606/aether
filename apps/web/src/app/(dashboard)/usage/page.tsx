'use client';

import { useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@aether/ui/primitives';
import { Tabs, TabsList, TabsTrigger } from '@aether/ui/primitives';
import { AlertCircle, BarChart3, TrendingUp, Zap } from 'lucide-react';
import {
  useMeteredUsage,
  useMeteredUsageTotal,
} from '@/hooks/billing/use-account-state';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2 } from 'lucide-react';

type Period = '7d' | '30d' | '90d';

function periodToDays(p: Period): number {
  return p === '7d' ? 7 : p === '30d' ? 30 : 90;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

const chartConfig: ChartConfig = {
  value: { label: 'Tokens', color: 'hsl(var(--chart-1))' },
};

export default function UsageDashboardPage() {
  const [period, setPeriod] = useState<Period>('30d');
  const days = periodToDays(period);
  const from = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [days]);

  const { data: usage, isLoading: usageLoading } = useMeteredUsage({
    from,
    windowSize: 'DAY',
  });

  const { data: total, isLoading: totalLoading } = useMeteredUsageTotal({
    from,
  });

  const chartData = useMemo(() => {
    if (!usage?.data) return [];
    return usage.data.map((pt) => ({
      date: formatDate(pt.windowStart),
      value: pt.value,
    }));
  }, [usage]);

  const dailyAvg = useMemo(() => {
    if (!chartData.length) return 0;
    const sum = chartData.reduce((acc, pt) => acc + pt.value, 0);
    return sum / chartData.length;
  }, [chartData]);

  const unavailable =
    !usageLoading && !totalLoading && usage === null && total === null;

  if (unavailable) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-8 gap-4 text-center" data-testid="usage-no-data">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">
            Usage metering not configured
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            OpenMeter integration is required for usage analytics. Contact your
            administrator to enable it.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-auto p-6 gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="usage-heading">Usage Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            LLM token consumption over time
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList data-testid="period-selector">
            <TabsTrigger value="7d">7 days</TabsTrigger>
            <TabsTrigger value="30d">30 days</TabsTrigger>
            <TabsTrigger value="90d">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Total Tokens"
          value={total?.total != null ? formatTokens(total.total) : undefined}
          icon={<Zap className="h-4 w-4 text-muted-foreground" />}
          loading={totalLoading}
        />
        <StatCard
          title="Daily Average"
          value={dailyAvg > 0 ? formatTokens(dailyAvg) : undefined}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          loading={usageLoading}
        />
        <StatCard
          title="Active Days"
          value={
            chartData.length > 0
              ? String(chartData.filter((d) => d.value > 0).length)
              : undefined
          }
          icon={<BarChart3 className="h-4 w-4 text-muted-foreground" />}
          loading={usageLoading}
        />
      </div>

      <Card data-testid="usage-chart">
        <CardHeader>
          <CardTitle>Daily Token Usage</CardTitle>
          <CardDescription>LLM tokens consumed per day</CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              No usage data available for this period
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  tickFormatter={formatTokens}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value?: string;
  icon: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card data-testid="stat-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="text-2xl font-bold">{value ?? '—'}</div>
        )}
      </CardContent>
    </Card>
  );
}
