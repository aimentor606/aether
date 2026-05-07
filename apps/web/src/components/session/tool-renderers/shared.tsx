'use client';

import { createTwoFilesPatch } from 'diff';
import { ToolError } from './tool-error';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle,
  ChevronRight,
  CircleAlert,
  ExternalLink,
  Globe,
  Loader2,
  MonitorPlay,
  RefreshCw,
  Search,
} from 'lucide-react';
import React, {
  type ComponentType,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { TextShimmer } from '@/components/ui/text-shimmer';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  renderHighlightedLine,
  useDiffHighlight,
} from '@/hooks/use-diff-highlight';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  type OutputSection,
  parseStructuredOutput,
} from '@/lib/utils/structured-output';
import { useAuthenticatedPreviewUrl } from '@/hooks/use-authenticated-preview-url';
import { useSandboxProxy } from '@/hooks/use-sandbox-proxy';
import {
  isProxiableLocalhostUrl,
  parseLocalhostUrl,
} from '@/lib/utils/sandbox-url';
import { openTabAndNavigate } from '@/stores/tab-store';
import {
  parseDiagnosticsFromToolOutput,
  type LspDiagnostic,
} from '@/stores/diagnostics-store';

import {
  type Diagnostic,
  getDiagnostics,
  type ToolPart,
  type TriggerTitle,
} from '@/ui';

// ============================================================================
// Shared CSS overrides — strip CodeBlock's nested border/bg/padding inside
// the BasicTool body wrapper to avoid the double-border look.
// ============================================================================

export const MD_FLUSH_CLASSES =
  '[&_.relative.group]:my-0 [&_pre]:my-0 [&_pre]:border-0 [&_pre]:bg-transparent [&_pre]:p-0 [&_pre]:rounded-none [&_pre]:text-xs [&_code]:text-xs';

// ============================================================================
// InlineServicePreview — reusable embedded iframe preview for localhost URLs
// ============================================================================

export function useProxyUrl(
  localhostUrl: string,
): { proxyUrl: string; port: number } | null {
  const { proxyUrl } = useSandboxProxy();

  return useMemo(() => {
    if (!localhostUrl) return null;
    if (!isProxiableLocalhostUrl(localhostUrl)) return null;
    const parsed = parseLocalhostUrl(localhostUrl);
    if (!parsed) return null;
    const resolvedProxyUrl = proxyUrl(localhostUrl);
    if (!resolvedProxyUrl) return null;
    return {
      proxyUrl: resolvedProxyUrl,
      port: parsed.port,
    };
  }, [localhostUrl, proxyUrl]);
}

export const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i;

export function normalizeWorkspacePath(path: string): string {
  const trimmed = path.trim();
  if (trimmed.startsWith('/workspace/')) return trimmed;
  if (trimmed === 'workspace') return '/workspace';
  if (trimmed.startsWith('workspace/')) return `/${trimmed}`;
  return trimmed;
}

export function isLocalSandboxFilePath(value: string): boolean {
  if (!value) return false;
  if (/^(https?:|data:|blob:)/i.test(value)) return false;
  return value.startsWith('/');
}

/** Ensure a sandbox file path starts with /workspace/ for the static file server. */
export function ensureWorkspacePath(filePath: string): string {
  if (filePath.startsWith('/workspace/')) return filePath;
  return '/workspace/' + filePath.replace(/^\/+/, '');
}

export function InlineServicePreview({
  url,
  label,
}: {
  url: string;
  label?: string;
}) {
  const proxy = useProxyUrl(url);
  const authenticatedUrl = useAuthenticatedPreviewUrl(proxy?.proxyUrl || url);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Scaled 1920×1080 viewport ──
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportScale, setViewportScale] = useState(0);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setViewportScale(w / 1920);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    setHasError(false);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => setIsLoading(false), 5000);
    return () => clearTimeout(t);
  }, [isLoading, refreshKey]);

  const displayLabel = label || (proxy ? `localhost:${proxy.port}` : url);

  const navigateToPreviewTab = useCallback(() => {
    if (!proxy) return;
    openTabAndNavigate({
      id: `preview:${proxy.port}`,
      title: `localhost:${proxy.port}`,
      type: 'preview',
      href: `/p/${proxy.port}`,
      metadata: {
        url: proxy.proxyUrl,
        port: proxy.port,
        originalUrl: url,
      },
    });
  }, [proxy, url]);

  const scaledHeight = viewportScale > 0 ? Math.round(1080 * viewportScale) : 0;

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {/* Mini browser toolbar */}
      <div className="flex items-center gap-1.5 h-8 px-2.5 bg-muted/40 border-b border-border/30 shrink-0">
        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <Globe className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <span className="text-[11px] text-muted-foreground font-mono truncate">
            {displayLabel}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleRefresh}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <RefreshCw
                className={cn('h-3 w-3', isLoading && 'animate-spin')}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Refresh</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() =>
                window.open(
                  authenticatedUrl ?? undefined,
                  '_blank',
                  'noopener,noreferrer',
                )
              }
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">Open in browser</TooltipContent>
        </Tooltip>
        {proxy && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                onClick={navigateToPreviewTab}
                variant="subtle"
                size="xs"
              >
                <MonitorPlay className="h-3 w-3" />
                Preview
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Open as tab</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Scaled 1920×1080 viewport — iframe renders at full desktop res, CSS-scaled to fit */}
      <div
        ref={viewportRef}
        className="relative overflow-hidden bg-white"
        style={{ height: scaledHeight > 0 ? `${scaledHeight}px` : '400px' }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-xs">Loading preview...</span>
            </div>
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center text-muted-foreground">
              <p className="text-xs">Failed to load</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="text-xs text-primary hover:underline mt-1"
              >
                Retry
              </button>
            </div>
          </div>
        )}
        {viewportScale > 0 && (
          <iframe
            key={refreshKey}
            src={authenticatedUrl ?? undefined}
            title={displayLabel}
            className="border-0 bg-white"
            style={{
              width: '1920px',
              height: '1080px',
              transform: `scale(${viewportScale})`,
              transformOrigin: '0 0',
              position: 'absolute',
              top: 0,
              left: 0,
            }}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads allow-modals"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ToolProps / ToolComponent types
// ============================================================================

export interface ToolProps {
  part: ToolPart;
  sessionId?: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  locked?: boolean;
  hasActiveQuestion?: boolean;
  onPermissionReply?: (
    requestId: string,
    reply: 'once' | 'always' | 'reject',
  ) => void;
}

export type ToolComponent = ComponentType<ToolProps>;

// ============================================================================
// Helper: parse partial/incomplete JSON from streaming tool input
// ============================================================================

// ============================================================================
// Helper: parse partial/incomplete JSON from streaming tool input
// ============================================================================

/**
 * Attempts to extract key-value pairs from a partial/incomplete JSON string.
 * This is used during fine-grained tool streaming when the tool arguments
 * are still being streamed and may not yet form valid JSON.
 *
 * Strategy:
 * 1. Try JSON.parse first (works if the JSON happens to be complete)
 * 2. Fall back to regex extraction of "key": "value" pairs
 */
export function parsePartialJSON(raw: string): Record<string, unknown> {
  if (!raw) return {};
  // Try full parse first
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch {
    // expected — JSON is incomplete
  }
  // Try closing braces/brackets to make it valid
  try {
    let attempt = raw.trim();
    // Count unclosed braces/brackets
    let braces = 0;
    let brackets = 0;
    let inString = false;
    let escape = false;
    for (const ch of attempt) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') braces++;
      if (ch === '}') braces--;
      if (ch === '[') brackets++;
      if (ch === ']') brackets--;
    }
    // If we're inside a string, close it
    if (inString) attempt += '"';
    // Close any open brackets/braces
    for (let i = 0; i < brackets; i++) attempt += ']';
    for (let i = 0; i < braces; i++) attempt += '}';
    const parsed = JSON.parse(attempt);
    if (typeof parsed === 'object' && parsed !== null) return parsed;
  } catch {
    // still can't parse
  }
  // Last resort: regex extract complete "key": "value" pairs
  const result: Record<string, unknown> = {};
  const re = /"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    result[m[1]] = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return result;
}

/**
 * Returns tool input, falling back to partial JSON from the streaming `raw`
 * field during the pending state. This allows tool renderers to show early
 * data (filenames, commands, etc.) before the full tool call is parsed.
 */
export function partStreamingInput(part: ToolPart): Record<string, unknown> {
  const input = part.state.input ?? {};
  if (Object.keys(input).length > 0) return input;
  // During pending/running state, try to parse the streaming raw field
  if (
    (part.state.status === 'pending' || part.state.status === 'running') &&
    'raw' in part.state
  ) {
    const raw = (part.state as any).raw as string;
    if (raw) return parsePartialJSON(raw);
  }
  return input;
}

// ============================================================================
// Helper: extract input/metadata/output/status from part
// ============================================================================

// ============================================================================
// Helper: extract input/metadata/output/status from part
// ============================================================================

export function partInput(part: ToolPart): Record<string, unknown> {
  return partStreamingInput(part);
}

export function partMetadata(part: ToolPart): Record<string, unknown> {
  if (
    part.state.status === 'completed' ||
    part.state.status === 'running' ||
    part.state.status === 'error'
  ) {
    return (part.state.metadata as Record<string, unknown>) ?? {};
  }
  return {};
}

export function partOutput(part: ToolPart): string {
  if (part.state.status === 'completed') {
    const raw = part.state.output ?? '';
    // Strip <bash_metadata> and similar internal XML tags from tool output
    return raw
      .replace(/<bash_metadata>[\s\S]*?<\/bash_metadata>/g, '')
      .replace(
        /<\/?(?:system_info|exit_code|stderr_note)>[\s\S]*?(?:<\/\w+>)?$/g,
        '',
      )
      .trim();
  }
  return '';
}

export function partStatus(part: ToolPart): string {
  return part.state.status;
}

export function firstMeaningfulLine(value: unknown, maxLength = 120): string {
  if (typeof value !== 'string') return '';
  const line = value
    .split('\n')
    .map((segment) => segment.trim())
    .find(Boolean);
  if (!line) return '';
  return line.length > maxLength ? `${line.slice(0, maxLength).trim()}…` : line;
}

export function getAgentCardLabel(input: Record<string, unknown>): string {
  const description = firstMeaningfulLine(input.description);
  if (description) return description;

  const title = firstMeaningfulLine(input.title, 80);
  if (title) return title;

  const message = firstMeaningfulLine(input.message);
  if (message) return message;

  const promptPreview = firstMeaningfulLine(input.prompt);
  if (promptPreview) return promptPreview;

  const agentId = firstMeaningfulLine(input.agent_id, 40);
  if (agentId) return `Agent ${agentId}`;

  return 'Worker task';
}

// ============================================================================
// StatusIcon
// ============================================================================

// ============================================================================
// StatusIcon
// ============================================================================

export function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <Check className="size-3 text-emerald-500 flex-shrink-0" />;
    case 'error':
      return (
        <CircleAlert className="size-3 text-muted-foreground flex-shrink-0" />
      );
    case 'running':
    case 'pending':
      return (
        <Loader2 className="size-3 animate-spin text-muted-foreground flex-shrink-0" />
      );
    default:
      return null;
  }
}

// ============================================================================
// TriggerTitle type guard
// ============================================================================

export function isTriggerTitle(val: unknown): val is TriggerTitle {
  return (
    typeof val === 'object' &&
    val !== null &&
    'title' in val &&
    typeof (val as TriggerTitle).title === 'string'
  );
}

// ============================================================================
// ToolEmptyState
// ============================================================================

// ============================================================================
// ToolEmptyState — subtle empty-state body for tools with no results.
// Ensures BasicTool still sees non-null children so the chevron renders.
// ============================================================================

export function ToolEmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 px-3 py-3 text-muted-foreground/60">
      <Search className="size-3" />
      <span className="text-[11px]">{message}</span>
    </div>
  );
}

// ============================================================================
// ToolOutputFallback
// ============================================================================

// ============================================================================
// ToolOutputFallback — smart fallback for raw tool output.
// Detects error-like text and renders it via ToolError; otherwise renders
// as UnifiedMarkdown (or plain pre for mono output).
// ============================================================================

/** Heuristic: does this output look like an error message? */
export function looksLikeError(text: string): boolean {
  const t = text.trim();
  if (t.length > 500) return false; // long output is probably real content
  if (/^Error:\s/i.test(t)) return true;
  if (/^([\w._-]+Error|[\w._-]+Exception):\s/i.test(t)) return true;
  if (/Traceback \(most recent call last\)/i.test(t)) return true;
  if (/^\s*\[\s*\{[\s\S]*"message"\s*:/.test(t)) return true; // JSON validation
  return false;
}

export interface ParsedJsonFailure {
  errorSummary: string;
  hint?: string;
  status?: number;
  nestedMessage?: string;
  nestedError?: boolean;
}

export function parseJsonFailure(output: string): ParsedJsonFailure | null {
  const trimmed = output.trim();
  if (!trimmed) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.success !== false || typeof parsed.error !== 'string') return null;

  const result: ParsedJsonFailure = {
    errorSummary: parsed.error.trim(),
    hint: typeof parsed.hint === 'string' ? parsed.hint.trim() : undefined,
  };

  const nestedMatch = result.errorSummary.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (!nestedMatch) return result;

  try {
    const nested = JSON.parse(nestedMatch[1]) as Record<string, unknown>;
    if (typeof nested.message === 'string' && nested.message.trim()) {
      result.nestedMessage = nested.message.trim();
    }
    if (typeof nested.status === 'number') {
      result.status = nested.status;
    }
    if (typeof nested.error === 'boolean') {
      result.nestedError = nested.error;
    }
  } catch {
    // keep base parsed shape only
  }

  return result;
}

export function JsonFailureOutputCard({
  failure,
  toolName,
}: {
  failure: ParsedJsonFailure;
  toolName?: string;
}) {
  return (
    <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 overflow-hidden text-xs">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-rose-500/20">
        <CircleAlert className="size-3.5 text-rose-500/80 flex-shrink-0" />
        <span className="font-medium text-rose-600 dark:text-rose-400">
          Integration request failed
        </span>
        {typeof failure.status === 'number' && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 font-mono">
            HTTP {failure.status}
          </span>
        )}
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <p className="text-[11px] leading-relaxed text-foreground/85 break-words">
          {failure.errorSummary}
        </p>
        {failure.nestedMessage && (
          <div className="rounded-md border border-border/40 bg-background/60 px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">
              Details
            </div>
            <p className="text-[11px] text-foreground/80 break-words">
              {failure.nestedMessage}
            </p>
          </div>
        )}
        {failure.hint && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-1.5">
            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-1">
              Hint
            </div>
            <p className="text-[11px] text-foreground/80 break-words">
              {failure.hint}
            </p>
          </div>
        )}
        {toolName && (
          <div className="text-[10px] text-muted-foreground/60 font-mono">
            Tool: {toolName}
          </div>
        )}
      </div>
    </div>
  );
}

export function formatJsonFailureOutput(output: string): string | null {
  const trimmed = output.trim();
  if (!trimmed) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    return null;
  }

  const success = parsed.success;
  const error = parsed.error;
  const hint = parsed.hint;

  if (success !== false || typeof error !== 'string') return null;

  const lines: string[] = [];
  lines.push(error.trim());

  const nestedMatch = error.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (nestedMatch) {
    try {
      const nested = JSON.parse(nestedMatch[1]) as Record<string, unknown>;
      const nestedMessage = nested.message;
      if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
        lines.push(`Details: ${nestedMessage.trim()}`);
      }
    } catch {
      // ignore malformed nested JSON in error string
    }
  }

  if (typeof hint === 'string' && hint.trim()) {
    lines.push(`Hint: ${hint.trim()}`);
  }

  return lines.join('\n\n');
}

export function ToolOutputFallback({
  output,
  isStreaming = false,
  toolName,
}: {
  output: string;
  isStreaming?: boolean;
  toolName?: string;
}) {
  const parsedJsonFailure = !isStreaming ? parseJsonFailure(output) : null;
  if (parsedJsonFailure) {
    return (
      <div className="p-0">
        <JsonFailureOutputCard
          failure={parsedJsonFailure}
          toolName={toolName}
        />
      </div>
    );
  }

  const jsonFailure = !isStreaming ? formatJsonFailureOutput(output) : null;
  if (jsonFailure) {
    return (
      <div className="p-0">
        <ToolError error={jsonFailure} toolName={toolName} />
      </div>
    );
  }

  if (!isStreaming && looksLikeError(output)) {
    return (
      <div className="p-0">
        <ToolError error={output} toolName={toolName} />
      </div>
    );
  }

  return (
    <div
      data-scrollable
      className={cn('p-2 max-h-72 overflow-auto', MD_FLUSH_CLASSES)}
    >
      <UnifiedMarkdown content={output} isStreaming={isStreaming} />
    </div>
  );
}

// ============================================================================
// BasicTool — collapsible wrapper
// ============================================================================

// ============================================================================
// BasicTool — collapsible wrapper
// ============================================================================

export interface BasicToolProps {
  icon: ReactNode;
  trigger: TriggerTitle | ReactNode;
  children?: ReactNode;
  defaultOpen?: boolean;
  forceOpen?: boolean;
  locked?: boolean;
  onSubtitleClick?: () => void;
}

/** Context to pass running state from ToolPartRenderer into BasicTool without prop drilling */
export const ToolRunningContext = createContext(false);
/** Context to pass stale-pending state from ToolPartRenderer into BasicTool */
export const StalePendingContext = createContext(false);

export function BasicTool({
  icon,
  trigger,
  children,
  defaultOpen = false,
  forceOpen,
  locked,
  onSubtitleClick,
}: BasicToolProps) {
  const running = useContext(ToolRunningContext);
  const [open, setOpen] = useState(defaultOpen);

  // Track if this tool just finished (running → not running) so we can
  // play a single completion shimmer. If it was already completed on mount
  // (e.g. reopening a session), don't shimmer.
  const wasRunningRef = useRef(running);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (wasRunningRef.current && !running) {
      setJustCompleted(true);
    }
    wasRunningRef.current = running;
  }, [running]);

  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const handleOpenChange = useCallback(
    (value: boolean) => {
      if (locked && !value) return;
      setOpen(value);
    },
    [locked],
  );

  // Determine if trigger content is effectively empty so we can show skeleton
  const triggerIsEmpty = isTriggerTitle(trigger)
    ? !trigger.title && !trigger.subtitle
    : false;

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger asChild>
        <div
          data-component="tool-trigger"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
            'bg-muted/20 border border-border/40',
            'text-xs transition-colors select-none',
            'cursor-pointer hover:bg-muted/40',
            'max-w-full group',
          )}
        >
          {/* Icon */}
          <span className="flex-shrink-0">{icon}</span>

          {/* Trigger content */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {isTriggerTitle(trigger) ? (
              <>
                <span className="font-medium text-xs text-foreground whitespace-nowrap">
                  {trigger.title}
                </span>
                {trigger.subtitle &&
                  (running ? (
                    <TextShimmer
                      duration={1}
                      spread={2}
                      className="text-xs truncate font-mono"
                    >
                      {trigger.subtitle}
                    </TextShimmer>
                  ) : (
                    <span
                      className={cn(
                        'text-muted-foreground text-xs truncate font-mono',
                        onSubtitleClick &&
                          'cursor-pointer hover:text-foreground underline-offset-2 hover:underline',
                      )}
                      onClick={
                        onSubtitleClick
                          ? (e) => {
                              e.stopPropagation();
                              onSubtitleClick();
                            }
                          : undefined
                      }
                    >
                      {justCompleted ? (
                        <TextShimmer
                          duration={1}
                          spread={2}
                          repeat={1}
                          className="text-xs font-mono"
                        >
                          {trigger.subtitle}
                        </TextShimmer>
                      ) : (
                        trigger.subtitle
                      )}
                    </span>
                  ))}
                {trigger.args &&
                  trigger.args.length > 0 &&
                  trigger.args.map((arg, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono whitespace-nowrap"
                    >
                      {arg}
                    </span>
                  ))}
              </>
            ) : (
              trigger
            )}
            {/* Skeleton placeholders when running but trigger has no content yet */}
            {running && triggerIsEmpty && (
              <>
                <span className="h-3 w-16 rounded bg-muted-foreground/10 animate-pulse" />
                <span className="h-3 w-28 rounded bg-muted-foreground/10 animate-pulse" />
              </>
            )}
          </div>

          {/* Right side: spinner when running (+ chevron if expandable), chevron when done */}
          {running && (
            <Loader2 className="size-3 animate-spin text-muted-foreground/60 flex-shrink-0" />
          )}
          {children && !locked && (
            <ChevronRight
              className={cn(
                'size-3 transition-transform flex-shrink-0 text-muted-foreground/50',
                open && 'rotate-90',
              )}
            />
          )}
        </div>
      </CollapsibleTrigger>

      {children && (
        <CollapsibleContent>
          <div className="mt-1.5 mb-2 rounded-lg bg-muted/20 border border-border/30 text-xs overflow-hidden">
            {children}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

// ============================================================================
// InlineDiffView
// ============================================================================

// ============================================================================
// InlineDiffView
// ============================================================================

export function InlineDiffView({
  oldValue,
  newValue,
  filename,
}: {
  oldValue: string;
  newValue: string;
  filename: string;
}) {
  const patch = useMemo(() => {
    if (!oldValue && !newValue) return '';
    return createTwoFilesPatch(
      filename,
      filename,
      oldValue || '',
      newValue || '',
      '',
      '',
    );
  }, [oldValue, newValue, filename]);

  const diffLines = useMemo(() => patch.split('\n').slice(4), [patch]);

  // Extract code content (without +/-/space prefix) for highlighting
  const codeLines = useMemo(
    () =>
      diffLines.map((line) => {
        if (line.startsWith('@@') || line === '') return '';
        return line.length > 0 ? line.substring(1) : '';
      }),
    [diffLines],
  );

  const highlighted = useDiffHighlight(codeLines, filename);

  if (!patch) return null;

  return (
    <pre className="p-2 font-mono text-[11px] leading-relaxed overflow-x-auto">
      {diffLines.map((line, i) => {
        const isAdd = line.startsWith('+');
        const isDel = line.startsWith('-');
        const isHunk = line.startsWith('@@');

        let cls = 'text-muted-foreground/80';
        if (isAdd) cls = 'bg-emerald-500/5';
        else if (isDel) cls = 'bg-red-500/5';
        else if (isHunk) cls = 'text-blue-500/70';

        if (isHunk || line === '') {
          return (
            <div key={i} className={cls}>
              {line}
            </div>
          );
        }

        const prefix = line[0] || ' ';
        const highlightedTokens = highlighted?.[i];

        if (highlightedTokens) {
          const html = renderHighlightedLine(highlightedTokens, codeLines[i]);
          return (
            <div key={i} className={cls}>
              <span
                className={cn(
                  isAdd && 'text-emerald-500',
                  isDel && 'text-red-500',
                )}
              >
                {prefix}
              </span>
              <span dangerouslySetInnerHTML={{ __html: html }} />
            </div>
          );
        }

        return (
          <div
            key={i}
            className={cn(
              cls,
              isAdd && 'text-emerald-500',
              isDel && 'text-red-500',
            )}
          >
            {line}
          </div>
        );
      })}
    </pre>
  );
}

// ============================================================================
// Extract diagnostics from tool output OR metadata
// ============================================================================

/**
 * Extract diagnostics for a specific file from tool part data.
 *
 * Tries two sources:
 * 1. Parse from tool output text (primary — backend embeds in XML tags)
 * 2. Read from metadata.diagnostics (legacy / fork path)
 */
export function getToolDiagnostics(
  part: ToolPart,
  filePath: string | undefined,
): Diagnostic[] {
  if (!filePath) return [];

  // 1. Parse from tool output text
  const output = partOutput(part);
  if (
    output &&
    (output.includes('<file_diagnostics>') ||
      output.includes('<project_diagnostics>'))
  ) {
    const parsed = parseDiagnosticsFromToolOutput(output);
    // Find diagnostics matching this file (by exact match or suffix)
    let diags: LspDiagnostic[] | undefined;
    for (const [key, value] of Object.entries(parsed)) {
      if (
        key === filePath ||
        key.endsWith('/' + filePath) ||
        filePath.endsWith('/' + key)
      ) {
        diags = value;
        break;
      }
    }
    // If no file-specific match, collect all
    if (!diags) {
      diags = Object.values(parsed).flat();
    }
    if (diags && diags.length > 0) {
      return diags
        .filter((d) => d.severity === 1 || d.severity === 2)
        .slice(0, 5)
        .map((d) => ({
          range: {
            start: { line: d.line, character: d.column },
            end: {
              line: d.endLine ?? d.line,
              character: d.endColumn ?? d.column,
            },
          },
          message: d.message,
          severity: d.severity,
        }));
    }
  }

  // 2. Fallback: metadata.diagnostics (legacy)
  const metadata = partMetadata(part);
  return getDiagnostics(
    metadata.diagnostics as Record<string, Diagnostic[]> | undefined,
    filePath,
  );
}

// ============================================================================
// DiagnosticsDisplay
// ============================================================================

// ============================================================================
// DiagnosticsDisplay
// ============================================================================

export function DiagnosticsDisplay({
  diagnostics,
  filePath,
}: {
  diagnostics: Diagnostic[];
  filePath?: string;
}) {
  if (diagnostics.length === 0) return null;

  const handleClick = (d: Diagnostic) => {
    if (!filePath) return;
    const targetLine = d.range.start.line + 1; // 1-indexed
    const tabId = `file:${filePath}`;
    const fileName = filePath.split('/').pop() || filePath;
    openTabAndNavigate({
      id: tabId,
      title: fileName,
      type: 'file',
      href: `/files/${encodeURIComponent(filePath)}`,
      metadata: { targetLine },
    });
  };

  return (
    <div className="space-y-1 px-2 pb-2">
      {diagnostics.map((d, i) => {
        const isError = d.severity === 1;
        const isWarning = d.severity === 2;
        return (
          <button
            type="button"
            key={i}
            className={cn(
              'flex items-start gap-1.5 text-[10px] transition-colors cursor-pointer text-left w-full group',
              isError && 'text-red-500 hover:text-red-400',
              isWarning && 'text-yellow-500 hover:text-yellow-400',
              !isError && !isWarning && 'text-blue-400 hover:text-blue-300',
            )}
            onClick={() => handleClick(d)}
          >
            {isError ? (
              <CircleAlert className="size-3 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-3 flex-shrink-0 mt-0.5" />
            )}
            <span className="group-hover:underline">
              [{d.range.start.line + 1}:{d.range.start.character + 1}]{' '}
              {d.message}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// DiffChanges
// ============================================================================

// ============================================================================
// DiffChanges
// ============================================================================

export function DiffChanges({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  if (additions === 0 && deletions === 0) return null;

  return (
    <span className="flex items-center gap-1.5 text-[10px] ml-auto whitespace-nowrap">
      {additions > 0 && <span className="text-emerald-500">+{additions}</span>}
      {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
    </span>
  );
}

// ============================================================================
// Structured Output — imported from shared utility
// ============================================================================

// ============================================================================
// Structured Output — imported from shared utility
// ============================================================================

/**
 * Render parsed structured output sections with semantic styling.
 */
export function StructuredOutput({ sections }: { sections: OutputSection[] }) {
  const [showTrace, setShowTrace] = useState(false);

  return (
    <div className="space-y-1.5 p-2.5">
      {sections.map((section, i) => {
        switch (section.type) {
          case 'warning':
            return (
              <div
                key={i}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-yellow-500/5 border border-yellow-500/15"
              >
                <AlertTriangle className="size-3 flex-shrink-0 mt-0.5 text-yellow-500" />
                <p className="text-[11px] leading-relaxed text-yellow-700 dark:text-yellow-400 font-mono break-words">
                  {section.text}
                </p>
              </div>
            );

          case 'error':
            return (
              <div
                key={i}
                className="flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border/60"
              >
                <Ban className="size-3 flex-shrink-0 mt-0.5 text-muted-foreground/70" />
                <div className="min-w-0 flex-1">
                  {section.errorType && (
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.errorType}
                    </span>
                  )}
                  <p className="text-[11px] leading-relaxed text-muted-foreground font-mono break-words">
                    {section.summary}
                  </p>
                </div>
              </div>
            );

          case 'traceback':
            return (
              <div key={i}>
                <button
                  onClick={() => setShowTrace((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30 transition-colors cursor-pointer w-full text-left"
                >
                  <ChevronRight
                    className={cn(
                      'size-3 transition-transform flex-shrink-0',
                      showTrace && 'rotate-90',
                    )}
                  />
                  <span className="text-[10px] font-medium">Stack trace</span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono ml-1">
                    {section.lines.length} lines
                  </span>
                </button>
                {showTrace && (
                  <div className="mt-1 rounded-md bg-muted/20 border border-border/30 overflow-hidden">
                    <pre className="p-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground/60 whitespace-pre-wrap break-all max-h-64 overflow-auto">
                      {section.lines.map((line, li) => {
                        // Highlight File "..." lines within the trace
                        if (/^\s+File "/.test(line)) {
                          return (
                            <span key={li} className="text-muted-foreground/80">
                              {line}
                              {'\n'}
                            </span>
                          );
                        }
                        return (
                          <span key={li}>
                            {line}
                            {'\n'}
                          </span>
                        );
                      })}
                    </pre>
                  </div>
                )}
              </div>
            );

          case 'install':
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-emerald-500/5 border border-emerald-500/15"
              >
                <CheckCircle className="size-3 flex-shrink-0 text-emerald-500" />
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono">
                  {section.text}
                </span>
              </div>
            );

          case 'info':
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-2.5 py-1 text-[11px] text-muted-foreground font-mono"
              >
                <span className="size-1 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                <span className="break-words">{section.text}</span>
              </div>
            );

          case 'plain':
            return (
              <pre
                key={i}
                className="px-2.5 py-1 font-mono text-[11px] leading-relaxed text-foreground/70 whitespace-pre-wrap break-words"
              >
                {section.text}
              </pre>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
