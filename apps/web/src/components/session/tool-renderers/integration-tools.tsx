'use client';

import React, {
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  Code2,
  Cpu,
  ExternalLink,
  Globe,
  Layers,
  ListTree,
  Loader2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIntegrationConnectStore } from '@/stores/integration-connect-store';
import { useAuth } from '@/components/AuthProvider';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  MD_FLUSH_CLASSES,
  partInput,
  partOutput,
  partStatus,
  ToolEmptyState,
  ToolOutputFallback,
  BasicTool,
} from './shared';

// ============================================================================
// Integration Tools (integration-list, integration-connect, integration-search,
//   integration-actions, integration-run, integration-request, integration-exec)
// ============================================================================

// ── integration-list ─────────────────────────────────────────────────────────

function IntegrationListTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const status = partStatus(part);
  const output = partOutput(part);

  const result = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const integrations: Array<{
    app: string;
    appName?: string;
    label?: string;
    status?: string;
  }> = result?.integrations ?? [];

  const badge =
    status === 'completed' && integrations.length > 0
      ? `${integrations.length} connected`
      : status === 'completed'
        ? 'none connected'
        : undefined;

  return (
    <BasicTool
      icon={<Layers className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Integration List
          </span>
          {badge && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ml-auto flex-shrink-0',
                integrations.length > 0
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {badge}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {integrations.length > 0 ? (
        <div className="divide-y divide-border/30">
          {integrations.map((intg, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2">
              <div className="size-6 rounded bg-muted/60 flex items-center justify-center flex-shrink-0">
                <Layers className="size-3 text-muted-foreground/60" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-foreground">
                  {intg.appName || intg.app}
                </div>
                {intg.label && (
                  <div className="text-[10px] text-muted-foreground/60 truncate">
                    {intg.label}
                  </div>
                )}
              </div>
              {intg.status && (
                <span
                  className={cn(
                    'text-[0.5625rem] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                    intg.status === 'connected'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-muted/60 text-muted-foreground',
                  )}
                >
                  {intg.status}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : status === 'completed' ? (
        <ToolEmptyState message="No integrations connected yet" />
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-list"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-list', IntegrationListTool);

// ── integration-connect ───────────────────────────────────────────────────────

function IntegrationConnectTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);
  const { user } = useAuth();
  const { triggerConnect, connectingApp } = useIntegrationConnectStore();

  const app = (input.app as string) || '';

  const result = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const connectUrl: string | undefined = result?.connectUrl;
  const success: boolean = result?.success ?? false;

  // Extract the app slug and sandbox_id from the connectUrl
  const { appSlug, sandboxId } = useMemo(() => {
    if (!connectUrl) return { appSlug: app, sandboxId: undefined };
    try {
      const url = new URL(connectUrl, window.location.origin);
      return {
        appSlug: url.searchParams.get('connect') || app,
        sandboxId: url.searchParams.get('sandbox_id') || undefined,
      };
    } catch {
      return { appSlug: app, sandboxId: undefined };
    }
  }, [connectUrl, app]);

  const isConnecting = connectingApp === appSlug;

  const handleClick = useCallback(() => {
    if (!user?.id || isConnecting) return;
    triggerConnect(appSlug, sandboxId);
  }, [user?.id, isConnecting, triggerConnect, appSlug, sandboxId]);

  return (
    <BasicTool
      icon={<ExternalLink className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Connect Integration
          </span>
          {app && (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {app}
            </span>
          )}
          {status === 'completed' && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ml-auto flex-shrink-0',
                success
                  ? 'bg-primary/10 text-primary'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {success ? (isConnecting ? 'connecting…' : 'ready') : 'failed'}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {connectUrl ? (
        <div className="px-3 py-2.5 space-y-2">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Click below to connect <strong>{appSlug}</strong> via OAuth.
          </p>
          <button
            type="button"
            onClick={handleClick}
            disabled={isConnecting}
            className={cn(
              'group flex items-center gap-2 p-2.5 rounded-lg border transition-colors w-full text-left',
              isConnecting
                ? 'bg-muted/40 border-muted cursor-wait'
                : 'bg-primary/5 border-primary/20 hover:bg-primary/10 cursor-pointer',
            )}
          >
            {isConnecting ? (
              <Loader2 className="size-3.5 text-primary flex-shrink-0 animate-spin" />
            ) : (
              <ExternalLink className="size-3.5 text-primary flex-shrink-0" />
            )}
            <span className="text-[11px] font-medium text-primary truncate flex-1 min-w-0">
              {isConnecting ? `Connecting ${appSlug}…` : `Connect ${appSlug}`}
            </span>
          </button>
        </div>
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-connect"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-connect', IntegrationConnectTool);

// ── integration-search ────────────────────────────────────────────────────────

function IntegrationSearchTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);

  const query = (input.q as string) || '';

  const result = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const apps: Array<{ slug: string; name: string; description?: string }> =
    result?.apps ?? [];
  const totalCount: number = result?.totalCount ?? apps.length;

  const badge =
    status === 'completed' && totalCount > 0
      ? `${totalCount} found`
      : status === 'completed'
        ? 'no results'
        : undefined;

  return (
    <BasicTool
      icon={<Search className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Integration Search
          </span>
          {query && (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {query}
            </span>
          )}
          {badge && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ml-auto flex-shrink-0',
                apps.length > 0
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {badge}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {apps.length > 0 ? (
        <div className="divide-y divide-border/30">
          {apps.map((app, i) => (
            <div key={i} className="flex items-start gap-2.5 px-3 py-2">
              <div className="size-6 rounded bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Globe className="size-3 text-muted-foreground/60" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-foreground">
                    {app.name}
                  </span>
                  <span className="text-[0.5625rem] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 font-mono">
                    {app.slug}
                  </span>
                </div>
                {app.description && (
                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-2 mt-0.5">
                    {app.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : status === 'completed' ? (
        <ToolEmptyState message={`No apps found for "${query}"`} />
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-search"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-search', IntegrationSearchTool);

// ── integration-actions ───────────────────────────────────────────────────────

function IntegrationActionsTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);

  const app = (input.app as string) || '';
  const query = (input.q as string) || '';

  const result = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const actions: Array<{
    key: string;
    name: string;
    description?: string;
    required_params?: string[];
    optional_params?: string[];
  }> = result?.actions ?? [];

  const badge =
    status === 'completed' && actions.length > 0
      ? `${actions.length} actions`
      : undefined;

  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <BasicTool
      icon={<ListTree className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Integration Actions
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {app}
            {query ? ` · ${query}` : ''}
          </span>
          {badge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap ml-auto flex-shrink-0">
              {badge}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {actions.length > 0 ? (
        <div
          data-scrollable
          className="max-h-[400px] overflow-auto divide-y divide-border/30"
        >
          {actions.map((action, i) => {
            const isOpen = expanded === i;
            const hasDetails =
              (action.required_params && action.required_params.length > 0) ||
              (action.optional_params && action.optional_params.length > 0) ||
              action.description;

            return (
              <div key={i}>
                <button
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer text-left"
                  onClick={() => hasDetails && setExpanded(isOpen ? null : i)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-foreground">
                      {action.name}
                    </div>
                    <div className="text-[0.5625rem] font-mono text-muted-foreground/50 mt-0.5">
                      {action.key}
                    </div>
                  </div>
                  {action.required_params &&
                    action.required_params.length > 0 && (
                      <span className="text-[0.5625rem] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/60 flex-shrink-0">
                        {action.required_params.length} req
                      </span>
                    )}
                  {hasDetails && (
                    <ChevronRight
                      className={cn(
                        'size-3 text-muted-foreground/60 flex-shrink-0 transition-transform',
                        isOpen && 'rotate-90',
                      )}
                    />
                  )}
                </button>
                {isOpen && hasDetails && (
                  <div className="px-3 pb-2.5 space-y-2">
                    {action.description && (
                      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                        {action.description}
                      </p>
                    )}
                    {action.required_params &&
                      action.required_params.length > 0 && (
                        <div>
                          <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                            Required
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {action.required_params.map((p, pi) => (
                              <span
                                key={pi}
                                className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-muted/60 font-mono text-foreground/70"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    {action.optional_params &&
                      action.optional_params.length > 0 && (
                        <div>
                          <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                            Optional
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {action.optional_params.map((p, pi) => (
                              <span
                                key={pi}
                                className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-muted/40 font-mono text-muted-foreground/60"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : status === 'completed' ? (
        <ToolEmptyState message="No actions found" />
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-actions"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-actions', IntegrationActionsTool);

// ── integration-run ───────────────────────────────────────────────────────────

function IntegrationRunTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);

  const app = (input.app as string) || '';
  const actionKey = (input.action_key as string) || '';

  const result = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const success: boolean | undefined = result?.success;
  const errorMsg: string | undefined = result?.error;
  const hint: string | undefined = result?.hint;

  // Strip the app/action_key prefix from the action key label
  const actionLabel = actionKey.replace(`${app}-`, '').replace(/-/g, ' ');

  return (
    <BasicTool
      icon={<Cpu className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Run Action
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {app}
            {actionKey ? ` · ${actionLabel}` : ''}
          </span>
          {status === 'completed' && success !== undefined && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ml-auto flex-shrink-0',
                success
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {success ? 'success' : 'failed'}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {result ? (
        <div className="px-3 py-2.5 space-y-2">
          {success === false && errorMsg ? (
            <>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="size-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-destructive font-medium">
                    Action failed
                  </p>
                  <p className="text-[10px] text-destructive/80 mt-0.5 font-mono break-all">
                    {errorMsg}
                  </p>
                </div>
              </div>
              {hint && (
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  {hint}
                </p>
              )}
            </>
          ) : success === true ? (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle className="size-3.5 text-emerald-600 flex-shrink-0" />
              <p className="text-[11px] text-emerald-700 font-medium">
                Action completed successfully
              </p>
            </div>
          ) : (
            <ToolOutputFallback
              output={output}
              isStreaming={status === 'running'}
              toolName="integration-run"
            />
          )}
        </div>
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-run"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-run', IntegrationRunTool);

// ── integration-request ───────────────────────────────────────────────────────

function IntegrationRequestTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);

  const app = (input.app as string) || '';
  const method = ((input.method as string) || 'GET').toUpperCase();
  const url = (input.url as string) || '';

  // Shorten URL for display — strip scheme + host if known
  const urlDisplay = useMemo(() => {
    try {
      const u = new URL(url);
      return u.pathname + (u.search || '');
    } catch {
      return url;
    }
  }, [url]);

  const result = useMemo(() => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const success: boolean | undefined = result?.success;
  const errorMsg: string | undefined = result?.error;
  const hint: string | undefined = result?.hint;
  const httpStatus: number | undefined = result?.status;
  const body = result?.body;

  const isOk =
    success !== false && (httpStatus === undefined || httpStatus < 400);

  return (
    <BasicTool
      icon={<Globe className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            HTTP Request
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 font-mono text-muted-foreground flex-shrink-0">
            {method}
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono flex-1 min-w-0">
            {app}
            {urlDisplay ? ` · ${urlDisplay}` : ''}
          </span>
          {status === 'completed' && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ml-auto flex-shrink-0',
                isOk
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              {httpStatus ? `${httpStatus}` : isOk ? 'ok' : 'failed'}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {result ? (
        <div className="px-3 py-2.5 space-y-2">
          {success === false ||
          (httpStatus !== undefined && httpStatus >= 400) ? (
            <>
              <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="size-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] text-destructive font-medium">
                    Request failed{httpStatus ? ` (${httpStatus})` : ''}
                  </p>
                  {errorMsg && (
                    <p className="text-[10px] text-destructive/80 mt-0.5 font-mono break-all">
                      {errorMsg}
                    </p>
                  )}
                </div>
              </div>
              {hint && (
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  {hint}
                </p>
              )}
            </>
          ) : body !== undefined ? (
            <div
              className={cn(
                'max-h-[300px] overflow-auto rounded-lg bg-muted/40 border border-border/40 p-2',
                MD_FLUSH_CLASSES,
              )}
            >
              <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap break-all">
                {typeof body === 'string'
                  ? body
                  : JSON.stringify(body, null, 2)}
              </pre>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle className="size-3.5 text-emerald-600 flex-shrink-0" />
              <p className="text-[11px] text-emerald-700 font-medium">
                Request successful
              </p>
            </div>
          )}
        </div>
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-request"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-request', IntegrationRequestTool);

// ── integration-exec ──────────────────────────────────────────────────────────

function IntegrationExecTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);

  const app = (input.app as string) || '';
  // Truncate the code for display in the trigger
  const codeSnippet = useMemo(() => {
    const code = (input.code as string) || '';
    const firstLine = code.trim().split('\n')[0] || '';
    return firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;
  }, [input.code]);

  const result = useMemo((): Record<string, unknown> | null => {
    if (!output) return null;
    try {
      return JSON.parse(output);
    } catch {
      return null;
    }
  }, [output]);

  const success = result?.success as boolean | undefined;
  const exitCode = result?.exit_code as number | undefined;
  const stdout: string = (result?.stdout as string) || '';
  const stderr: string = (result?.stderr as string) || '';

  const isOk = success !== false && (exitCode === undefined || exitCode === 0);

  return (
    <BasicTool
      icon={<Code2 className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Exec Code
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono flex-1 min-w-0">
            {app}
            {codeSnippet ? ` · ${codeSnippet}` : ''}
          </span>
          {status === 'completed' && exitCode !== undefined && (
            <span
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ml-auto flex-shrink-0',
                isOk
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-destructive/10 text-destructive',
              )}
            >
              exit {exitCode}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {!!result ? (
        <div className="space-y-0">
          {/* Code input */}
          {!!input.code && (
            <div className="px-3 pt-2.5 pb-1">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                Code
              </div>
              <div
                className={cn(
                  'rounded-lg bg-muted/40 border border-border/40 p-2 max-h-[200px] overflow-auto',
                  MD_FLUSH_CLASSES,
                )}
              >
                <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap">
                  {String(input.code)}
                </pre>
              </div>
            </div>
          )}
          {/* stdout */}
          {stdout && (
            <div className="px-3 pt-1.5 pb-1">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">
                Output
              </div>
              <div className="rounded-lg bg-muted/40 border border-border/40 p-2 max-h-[200px] overflow-auto">
                <pre className="text-[10px] font-mono text-foreground/80 whitespace-pre-wrap">
                  {stdout}
                </pre>
              </div>
            </div>
          )}
          {/* stderr */}
          {stderr && (
            <div className="px-3 pt-1.5 pb-2.5">
              <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-destructive/50 mb-1">
                Stderr
              </div>
              <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-2 max-h-[150px] overflow-auto">
                <pre className="text-[10px] font-mono text-destructive/80 whitespace-pre-wrap">
                  {stderr}
                </pre>
              </div>
            </div>
          )}
          {!stdout && !stderr && (
            <div className="px-3 py-2.5">
              <div
                className={cn(
                  'flex items-center gap-2 p-2 rounded-lg border',
                  isOk
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : 'bg-destructive/5 border-destructive/20',
                )}
              >
                {isOk ? (
                  <CheckCircle className="size-3.5 text-emerald-600 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="size-3.5 text-destructive flex-shrink-0" />
                )}
                <p
                  className={cn(
                    'text-[11px] font-medium',
                    isOk ? 'text-emerald-700' : 'text-destructive',
                  )}
                >
                  {isOk
                    ? 'Executed successfully'
                    : `Failed with exit code ${exitCode}`}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="integration-exec"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('integration-exec', IntegrationExecTool);
