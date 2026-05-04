'use client';

import { useApiClient, useLiteLLMAdmin } from '@aether/sdk/client';
import { Card, CardContent, Badge, Separator } from '@aether/ui/primitives';

export default function LiteLLMAdminPage() {
  const client = useApiClient();
  const admin = useLiteLLMAdmin(client);

  const models = admin.models.data ?? [];
  const health = admin.health.data;
  const isHealthy =
    health?.status === 'healthy' || health?.status === 'connected';

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1
          className="text-xl font-semibold"
          data-testid="admin-litellm-heading"
        >
          LiteLLM Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Model catalog, proxy health, and provider status
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="litellm-status-card">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">Proxy Status</div>
              <div className="flex items-center gap-2 mt-1">
                <div
                  className={`h-2.5 w-2.5 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-red-500'}`}
                />
                <span className="font-medium capitalize">
                  {health?.status ?? 'checking...'}
                </span>
              </div>
              {health?.error && (
                <p className="text-xs text-red-500 mt-1">{health.error}</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="litellm-status-card">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                Registered Models
              </div>
              <div className="text-2xl font-bold mt-1">{models.length}</div>
            </CardContent>
          </Card>

          <Card data-testid="litellm-status-card">
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">
                Free Tier Models
              </div>
              <div className="text-2xl font-bold mt-1">
                {models.filter((m) => m.tier === 'free').length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Model Catalog Table */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Model Catalog</h2>
          <div className="rounded-md border" data-testid="model-catalog-table">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Model ID</th>
                  <th className="text-left p-3 font-medium">Context Window</th>
                  <th className="text-right p-3 font-medium">Input $/1M</th>
                  <th className="text-right p-3 font-medium">Output $/1M</th>
                  <th className="text-center p-3 font-medium">Tier</th>
                </tr>
              </thead>
              <tbody>
                {models.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center text-muted-foreground p-8"
                    >
                      No models found
                    </td>
                  </tr>
                ) : (
                  models.map((model) => (
                    <tr
                      key={model.id}
                      className="border-b last:border-0 hover:bg-muted/30"
                    >
                      <td className="p-3 font-mono text-xs">{model.id}</td>
                      <td className="p-3">
                        {(model.context_window / 1024).toFixed(0)}K
                      </td>
                      <td className="p-3 text-right font-mono">
                        ${model.pricing.input.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono">
                        ${model.pricing.output.toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <Badge
                          className={
                            model.tier === 'free'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }
                        >
                          {model.tier}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deployed Models from LiteLLM Proxy */}
        {admin.deployedModels.data && admin.deployedModels.data.length > 0 && (
          <>
            <Separator />
            <div>
              <h2 className="text-lg font-semibold mb-3">
                Deployed Models (Proxy)
              </h2>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Model</th>
                      <th className="text-left p-3 font-medium">
                        LiteLLM Params
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {admin.deployedModels.data.map(
                      (model: Record<string, unknown>, i: number) => {
                        const info =
                          (model.model_info as Record<string, unknown>) ?? {};
                        return (
                          <tr
                            key={i}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="p-3 font-mono text-xs">
                              {String(model.model_name ?? model.model ?? '—')}
                            </td>
                            <td className="p-3 text-xs text-muted-foreground">
                              {info.litellm_params ? (
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(info.litellm_params, null, 2)}
                                </pre>
                              ) : (
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(model, null, 2).slice(0, 200)}
                                </pre>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
