'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  RefreshCw,
  Plus,
  Trash2,
  Play,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Zap,
  Server,
  Settings,
} from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  Input,
  Progress,
} from '@aether/ui/primitives';
import { useApiClient, useAdminSandboxPool } from '@aether/sdk/client';
import { toast } from '@/lib/toast';

export default function SandboxPoolAdminPage() {
  const [createCount, setCreateCount] = useState(1);

  const client = useApiClient();
  const pool = useAdminSandboxPool(client, { listLimit: 50 });

  const { data: health, isLoading: healthLoading } = pool.health;
  const { data: stats, isLoading: statsLoading } = pool.stats;
  const { data: sandboxes, isLoading: sandboxesLoading } = pool.list;

  const handleReplenish = () => {
    pool.replenish
      .mutateAsync(undefined as never)
      .then((data: any) => {
        toast.success(
          `Created ${data.sandboxes_created ?? data.created} sandboxes. Pool size: ${data.pool_size_after ?? data.created}`,
        );
      })
      .catch(() => {
        toast.error('Failed to replenish pool');
      });
  };

  const handleForceCreate = () => {
    pool.forceCreate
      .mutateAsync({ count: createCount })
      .then((data: any) => {
        toast.success(
          `Created ${data.created_count ?? data.created}/${data.requested ?? createCount} sandboxes`,
        );
        if ((data.failed_count ?? data.failed ?? 0) > 0) {
          toast.error(
            `${data.failed_count ?? data.failed} sandboxes failed to create`,
          );
        }
      })
      .catch(() => {
        toast.error('Failed to create sandboxes');
      });
  };

  const handleCleanup = () => {
    pool.cleanup
      .mutateAsync()
      .then((data: any) => {
        toast.success(
          `Cleaned up ${data.cleaned_count ?? data.removed} stale sandboxes`,
        );
      })
      .catch(() => {
        toast.error('Failed to cleanup pool');
      });
  };

  const handleRestart = () => {
    pool.restart
      .mutateAsync()
      .then((data: any) => {
        if (data.is_running ?? data.restarted) {
          toast.success('Pool service restarted successfully');
        } else {
          toast.error('Failed to restart pool service');
        }
      })
      .catch(() => {
        toast.error('Failed to restart pool service');
      });
  };

  const isLoading = healthLoading || statsLoading;
  const isAnyMutating =
    pool.replenish.isPending ||
    pool.forceCreate.isPending ||
    pool.cleanup.isPending ||
    pool.restart.isPending;
  const poolUtilization = useMemo(() => {
    const s = stats as any;
    if (!s?.pool_size || !s?.config?.max_size) return 0;
    return (s.pool_size / s.config.max_size) * 100;
  }, [stats]);

  const getHealthBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 gap-1.5 px-3 py-1">
            <CheckCircle className="w-3.5 h-3.5" /> Healthy
          </Badge>
        );
      case 'warning':
      case 'degraded':
        return (
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30 gap-1.5 px-3 py-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Warning
          </Badge>
        );
      case 'critical':
      case 'unhealthy':
        return (
          <Badge className="bg-red-500/10 text-red-400 border-red-500/30 gap-1.5 px-3 py-1">
            <XCircle className="w-3.5 h-3.5" /> Critical
          </Badge>
        );
      case 'disabled':
        return (
          <Badge variant="secondary" className="gap-1.5 px-3 py-1">
            Disabled
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5 px-3 py-1">
            Unknown
          </Badge>
        );
    }
  };

  const healthData = health as any;
  const statsData = stats as any;
  const sandboxesData = sandboxes as any;
  const issues: string[] = healthData?.issues ?? [];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <div className="flex-none border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Sandbox Pool
                </h1>
                <p className="text-sm text-muted-foreground">
                  Real-time pool monitoring and management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {health && getHealthBadge(healthData?.status ?? 'unknown')}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          {issues.length > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur">
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-400">
                      Issues Detected
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {issues.map((issue: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground">
                          • {issue}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Pool Size
                    </p>
                    <p className="text-4xl font-bold tracking-tight mt-1">
                      {isLoading ? '...' : (statsData?.pool_size ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {statsData?.config?.min_size ?? '-'} min /{' '}
                      {statsData?.config?.max_size ?? '-'} max
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Box className="w-6 h-6 text-secondary" />
                  </div>
                </div>
                <Progress
                  value={poolUtilization}
                  className="mt-4 h-1.5 bg-muted"
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Created
                    </p>
                    <p className="text-4xl font-bold tracking-tight mt-1">
                      {isLoading ? '...' : (statsData?.total_created ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Since service start
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Plus className="w-6 h-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Claimed
                    </p>
                    <p className="text-4xl font-bold tracking-tight mt-1">
                      {isLoading ? '...' : (statsData?.total_claimed ?? 0)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Hit rate: {statsData?.pool_hit_rate?.toFixed(1) ?? 0}%
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Avg Claim Time
                    </p>
                    <p className="text-4xl font-bold tracking-tight mt-1">
                      {isLoading
                        ? '...'
                        : `${statsData?.avg_claim_time_ms?.toFixed(0) ?? 0}`}
                      <span className="text-lg font-normal text-muted-foreground">
                        ms
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Expired: {statsData?.total_expired ?? 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-secondary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-secondary" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Emergency controls and pool management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={handleReplenish}
                    disabled={isAnyMutating}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                      {pool.replenish.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-secondary" />
                      ) : (
                        <RefreshCw className="w-5 h-5 text-secondary" />
                      )}
                    </div>
                    <span className="text-sm font-medium">Replenish</span>
                  </button>

                  <button
                    onClick={handleCleanup}
                    disabled={isAnyMutating}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {pool.cleanup.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Trash2 className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium">Cleanup</span>
                  </button>

                  <button
                    onClick={handleRestart}
                    disabled={isAnyMutating}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {pool.restart.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Play className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium">Restart</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-border">
                  <p className="text-sm font-medium mb-3">
                    Force Create Sandboxes
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={createCount}
                      onChange={(e) =>
                        setCreateCount(
                          Math.min(
                            20,
                            Math.max(1, parseInt(e.target.value) || 1),
                          ),
                        )
                      }
                      className="w-20"
                    />
                    <Button
                      onClick={handleForceCreate}
                      disabled={isAnyMutating}
                    >
                      {pool.forceCreate.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Create {createCount}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-secondary" />
                  Configuration
                </CardTitle>
                <CardDescription>Current pool service settings</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 p-3 rounded-xl border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </p>
                    <p className="text-sm font-semibold">
                      {statsData?.config?.enabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Check Interval
                    </p>
                    <p className="text-sm font-semibold">
                      {statsData?.config?.check_interval ?? '-'}s
                    </p>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Max Age
                    </p>
                    <p className="text-sm font-semibold">
                      {statsData?.config?.max_age
                        ? `${Math.round(statsData.config.max_age / 60)}min`
                        : '-'}
                    </p>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Replenish At
                    </p>
                    <p className="text-sm font-semibold">
                      {statsData?.config?.replenish_threshold &&
                      statsData?.config?.min_size
                        ? `${Math.round(statsData.config.min_size * statsData.config.replenish_threshold)} (${(statsData.config.replenish_threshold * 100).toFixed(0)}%)`
                        : '-'}
                    </p>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last Replenish
                    </p>
                    <p className="text-sm font-semibold">
                      {statsData?.last_replenish_at
                        ? new Date(
                            statsData.last_replenish_at,
                          ).toLocaleTimeString()
                        : 'Never'}
                    </p>
                  </div>
                  <div className="space-y-1 p-3 rounded-xl border border-border">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Last Cleanup
                    </p>
                    <p className="text-sm font-semibold">
                      {statsData?.last_cleanup_at
                        ? new Date(
                            statsData.last_cleanup_at,
                          ).toLocaleTimeString()
                        : 'Never'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-secondary" />
                    Pooled Sandboxes
                  </CardTitle>
                  <CardDescription>
                    {sandboxesData?.count ?? sandboxesData?.total ?? 0}{' '}
                    sandboxes currently available in the pool
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-lg px-4 py-1">
                  {sandboxesData?.count ?? sandboxesData?.total ?? 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {sandboxesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : sandboxesData?.sandboxes &&
                sandboxesData.sandboxes.length > 0 ? (
                <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {sandboxesData.sandboxes.map(
                    (sandbox: any, index: number) => (
                      <div
                        key={sandbox.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center text-xs font-mono text-secondary">
                            {index + 1}
                          </div>
                          <code className="text-sm font-mono text-muted-foreground">
                            {sandbox.external_id}
                          </code>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground">
                            {(sandbox.pooled_at ?? sandbox.created_at)
                              ? `Pooled ${new Date(sandbox.pooled_at ?? sandbox.created_at).toLocaleTimeString()}`
                              : 'Unknown'}
                          </span>
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Box className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No sandboxes in pool</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Click &quot;Replenish Pool&quot; to create new sandboxes
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
