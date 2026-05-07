'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  StopCircle,
  Check,
  ChevronRight,
  Cpu,
  Layers,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { SubSessionModal } from '@/components/session/sub-session-modal';
import { HighlightedCode, UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { useOpenCodeMessages } from '@/hooks/opencode/use-opencode-sessions';
import { cn } from '@/lib/utils';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partOutput,
  partStatus,
  firstMeaningfulLine,
  getAgentCardLabel,
} from './shared';
import {
  getChildSessionId,
  getChildSessionToolParts,
  getToolInfo,
} from '@/ui';

// ============================================================================
// AgentSpawnTool — Aether agent delegation (replaces native task tool)
// Same UX as TaskTool: compact card, live shimmer, SubSessionModal
// ============================================================================

/** Clean agent_spawn output for display (strip ## Worker Result header, agent/session metadata) */
function cleanWorkerOutput(raw: string): string {
  if (!raw) return '';
  let text = raw;
  // Strip common agent output artifacts
  text = text.replace(/^##\s*Worker Result\s*\n/i, '');
  text = text.replace(/^\*\*Agent:\*\*.*\n?/m, '');
  text = text.replace(/^\*\*Task:\*\*.*\n?/m, '');
  text = text.replace(/^\*\*Status:\*\*.*\n?/m, '');
  text = text.replace(/^\*\*Session:\*\*.*\n?/m, '');
  text = text.replace(/^\*\*Duration:\*\*.*\n?/m, '');
  text = text.replace(/<promise>[^]*?<\/promise>/g, '');
  text = text.replace(/<DONE>/g, '');
  // Strip leading/trailing horizontal rules
  text = text.replace(/^---\s*\n/gm, '');
  text = text.trim();
  // If only whitespace/empty after cleaning, return ""
  return text || '';
}

/** Check if output is short enough to show inline (≤ 3 non-empty lines) */
function isShortOutput(cleaned: string): boolean {
  if (!cleaned) return false;
  const lines = cleaned.split('\n').filter((l) => l.trim());
  return lines.length <= 3;
}

/** Extract a one-line preview from cleaned worker output */
function extractWorkerPreview(cleaned: string): string | null {
  if (!cleaned) return null;
  // Grab the first non-empty, non-heading line
  const lines = cleaned
    .split('\n')
    .filter((l) => l.trim() && !l.startsWith('#'));
  const first = lines[0]?.replace(/^\*\*.*?\*\*\s*/, '').trim();
  if (!first) return null;
  return first.length > 120 ? first.slice(0, 120).trim() + '…' : first;
}

function AgentSpawnTool({ part, forceOpen }: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);
  const description = getAgentCardLabel(input);
  const isRunning = status === 'running' || status === 'pending';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  const childSessionId: string | undefined = useMemo(
    () => getChildSessionId(part),
    [part],
  );

  const { data: childMessages } = useOpenCodeMessages(childSessionId ?? '');
  const childToolParts = useMemo(() => {
    if (!childMessages) return [];
    return getChildSessionToolParts(childMessages as any);
  }, [childMessages]);

  const [modalOpen, setModalOpen] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const lastActivity = useMemo(() => {
    if (childToolParts.length === 0) return null;
    const last = childToolParts[childToolParts.length - 1];
    const info = getToolInfo(last.tool, partInput(last) as Record<string, any>);
    return info.title + (info.subtitle ? ` · ${info.subtitle}` : '');
  }, [childToolParts]);

  const cleanedOutput = useMemo(() => cleanWorkerOutput(output), [output]);
  const workerPreview = useMemo(
    () => extractWorkerPreview(cleanedOutput),
    [cleanedOutput],
  );

  const hasSession = !!childSessionId;

  return (
    <>
      <div
        className={cn(
          'rounded-lg border border-border/40 bg-muted/20 transition-colors select-none w-full group overflow-hidden',
        )}
      >
        {/* Clickable header area */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => hasSession && setModalOpen(true)}
          onKeyDown={(e) =>
            e.key === 'Enter' && hasSession && setModalOpen(true)
          }
          className={cn(
            'p-3',
            hasSession ? 'cursor-pointer hover:bg-accent/50' : '',
          )}
        >
          {/* Row 1: icon + description + status */}
          <div className="flex items-center gap-2.5">
            <Cpu className="size-4 text-muted-foreground flex-shrink-0" />

            <span className="text-[13px] font-medium text-foreground truncate flex-1">
              {description}
            </span>

            {isRunning && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium flex-shrink-0 flex items-center gap-1">
                <Loader2 className="size-2.5 animate-spin" />
                Running
              </span>
            )}
            {isCompleted && childToolParts.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                {childToolParts.length} steps
              </span>
            )}
            {isCompleted && childToolParts.length === 0 && !cleanedOutput && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0 flex items-center gap-1">
                <Check className="size-2.5" />
                Done
              </span>
            )}
            {isError && (
              <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                Failed
              </span>
            )}

            {hasSession && (
              <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
            )}
          </div>

          {/* Row 2: live activity */}
          {isRunning && (
            <div className="mt-2 pl-[26px]">
              {lastActivity ? (
                <TextShimmer
                  duration={1.5}
                  spread={2}
                  className="text-[11px] truncate font-mono text-muted-foreground"
                >
                  {lastActivity}
                </TextShimmer>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Starting…
                </span>
              )}
            </div>
          )}

          {/* Row 2: completed step summary (only when no worker output) */}
          {isCompleted && childToolParts.length > 0 && !cleanedOutput && (
            <div className="mt-2 pl-[26px] space-y-0.5">
              {childToolParts.slice(-3).map((tp, i) => {
                const info = getToolInfo(
                  tp.tool,
                  partInput(tp) as Record<string, any>,
                );
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"
                  >
                    <Check className="size-2.5 text-muted-foreground/50 flex-shrink-0" />
                    {info.title}
                    {info.subtitle ? ` · ${info.subtitle}` : ''}
                  </div>
                );
              })}
              {childToolParts.length > 3 && (
                <div className="text-[11px] text-muted-foreground/50 pl-4">
                  +{childToolParts.length - 3} more
                </div>
              )}
            </div>
          )}

          {/* Fallback: completed with no steps or output */}
          {isCompleted && childToolParts.length === 0 && !cleanedOutput && (
            <div className="mt-1.5 pl-[26px]">
              <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                <Check className="size-2.5" />
                Completed
              </span>
            </div>
          )}
        </div>

        {/* Worker result section */}
        {isCompleted && cleanedOutput && (
          <div className="border-t border-border/30">
            {isShortOutput(cleanedOutput) ? (
              /* Short result: show inline, no collapse */
              <div className="px-3 py-2.5">
                <div className="text-xs text-foreground/80 leading-relaxed border-l-2 border-border/40 pl-3 prose-sm [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_table]:text-[11px] [&_code]:text-[11px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_hr]:border-border/30 [&_hr]:my-3">
                  <UnifiedMarkdown
                    content={cleanedOutput}
                    isStreaming={false}
                  />
                </div>
              </div>
            ) : (
              /* Long result: collapsible */
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOutputExpanded(!outputExpanded);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'size-3 text-muted-foreground/60 transition-transform flex-shrink-0',
                      outputExpanded && 'rotate-90',
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0">
                    Result
                  </span>
                  {!outputExpanded && workerPreview && (
                    <span className="text-[11px] text-muted-foreground/60 truncate">
                      {workerPreview}
                    </span>
                  )}
                </button>
                {outputExpanded && (
                  <div
                    data-scrollable
                    className="px-3 pb-3 max-h-80 overflow-y-auto"
                  >
                    <div className="text-xs text-foreground/80 leading-relaxed border-l-2 border-border/40 pl-3 prose-sm [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_table]:text-[11px] [&_code]:text-[11px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_hr]:border-border/30 [&_hr]:my-3">
                      <UnifiedMarkdown
                        content={cleanedOutput}
                        isStreaming={false}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {hasSession && (
        <SubSessionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          sessionId={childSessionId}
          title={description}
        />
      )}
    </>
  );
}
ToolRegistry.register('agent_spawn', AgentSpawnTool);
ToolRegistry.register('agent-spawn', AgentSpawnTool);

// ============================================================================
// Agent utility tools — card components matching AgentSpawnTool visual standard
// ============================================================================

function AgentMessageTool({ part }: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);
  const output = partOutput(part);
  const message = firstMeaningfulLine(input.message, 240);
  const description = message
    ? message.length > 80
      ? message.slice(0, 80).trim() + '…'
      : message
    : 'Message sent to agent';
  const isRunning = status === 'running' || status === 'pending';
  const isCompleted = status === 'completed';
  const isError = status === 'error';

  const childSessionId: string | undefined = useMemo(
    () => getChildSessionId(part),
    [part],
  );

  const { data: childMessages } = useOpenCodeMessages(childSessionId ?? '');
  const childToolParts = useMemo(() => {
    if (!childMessages) return [];
    return getChildSessionToolParts(childMessages as any);
  }, [childMessages]);

  const [modalOpen, setModalOpen] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);

  const lastActivity = useMemo(() => {
    if (childToolParts.length === 0) return null;
    const last = childToolParts[childToolParts.length - 1];
    const info = getToolInfo(
      last.tool,
      (last.state.input ?? {}) as Record<string, any>,
    );
    return info.title + (info.subtitle ? ` · ${info.subtitle}` : '');
  }, [childToolParts]);

  const cleanedOutput = useMemo(() => cleanWorkerOutput(output), [output]);
  const workerPreview = useMemo(
    () => extractWorkerPreview(cleanedOutput),
    [cleanedOutput],
  );

  const hasSession = !!childSessionId;

  return (
    <>
      <div
        className={cn(
          'rounded-lg border border-border/40 bg-muted/20 transition-colors select-none w-full group overflow-hidden',
        )}
      >
        {/* Clickable header area */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => hasSession && setModalOpen(true)}
          onKeyDown={(e) =>
            e.key === 'Enter' && hasSession && setModalOpen(true)
          }
          className={cn(
            'p-3',
            hasSession ? 'cursor-pointer hover:bg-accent/50' : '',
          )}
        >
          {/* Row 1: icon + description + status */}
          <div className="flex items-center gap-2.5">
            <MessageCircle className="size-4 text-muted-foreground flex-shrink-0" />

            <span className="text-[13px] font-medium text-foreground truncate flex-1">
              {description}
            </span>

            {isRunning && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium flex-shrink-0 flex items-center gap-1">
                <Loader2 className="size-2.5 animate-spin" />
                Running
              </span>
            )}
            {isCompleted && childToolParts.length > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                {childToolParts.length} steps
              </span>
            )}
            {isCompleted && childToolParts.length === 0 && !cleanedOutput && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0 flex items-center gap-1">
                <Check className="size-2.5" />
                Done
              </span>
            )}
            {isError && (
              <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                Failed
              </span>
            )}

            {hasSession && (
              <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0" />
            )}
          </div>

          {/* Row 2: live activity */}
          {isRunning && (
            <div className="mt-2 pl-[26px]">
              {lastActivity ? (
                <TextShimmer
                  duration={1.5}
                  spread={2}
                  className="text-[11px] truncate font-mono text-muted-foreground"
                >
                  {lastActivity}
                </TextShimmer>
              ) : (
                <span className="text-[11px] text-muted-foreground">
                  Starting…
                </span>
              )}
            </div>
          )}

          {/* Row 2: completed step summary (only when no worker output) */}
          {isCompleted && childToolParts.length > 0 && !cleanedOutput && (
            <div className="mt-2 pl-[26px] space-y-0.5">
              {childToolParts.slice(-3).map((tp, i) => {
                const info = getToolInfo(
                  tp.tool,
                  partInput(tp) as Record<string, any>,
                );
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate"
                  >
                    <Check className="size-2.5 text-muted-foreground/50 flex-shrink-0" />
                    {info.title}
                    {info.subtitle ? ` · ${info.subtitle}` : ''}
                  </div>
                );
              })}
              {childToolParts.length > 3 && (
                <div className="text-[11px] text-muted-foreground/50 pl-4">
                  +{childToolParts.length - 3} more
                </div>
              )}
            </div>
          )}

          {/* Fallback: completed with no steps or output */}
          {isCompleted && childToolParts.length === 0 && !cleanedOutput && (
            <div className="mt-1.5 pl-[26px]">
              <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                <Check className="size-2.5" />
                Completed
              </span>
            </div>
          )}
        </div>

        {/* Worker result section */}
        {isCompleted && cleanedOutput && (
          <div className="border-t border-border/30">
            {isShortOutput(cleanedOutput) ? (
              /* Short result: show inline, no collapse */
              <div className="px-3 py-2.5">
                <div className="text-xs text-foreground/80 leading-relaxed border-l-2 border-border/40 pl-3 prose-sm [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_table]:text-[11px] [&_code]:text-[11px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_hr]:border-border/30 [&_hr]:my-3">
                  <UnifiedMarkdown
                    content={cleanedOutput}
                    isStreaming={false}
                  />
                </div>
              </div>
            ) : (
              /* Long result: collapsible */
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOutputExpanded(!outputExpanded);
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <ChevronRight
                    className={cn(
                      'size-3 text-muted-foreground/60 transition-transform flex-shrink-0',
                      outputExpanded && 'rotate-90',
                    )}
                  />
                  <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0">
                    Result
                  </span>
                  {!outputExpanded && workerPreview && (
                    <span className="text-[11px] text-muted-foreground/60 truncate">
                      {workerPreview}
                    </span>
                  )}
                </button>
                {outputExpanded && (
                  <div
                    data-scrollable
                    className="px-3 pb-3 max-h-80 overflow-y-auto"
                  >
                    <div className="text-xs text-foreground/80 leading-relaxed border-l-2 border-border/40 pl-3 prose-sm [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_table]:text-[11px] [&_code]:text-[11px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_hr]:border-border/30 [&_hr]:my-3">
                      <UnifiedMarkdown
                        content={cleanedOutput}
                        isStreaming={false}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {hasSession && (
        <SubSessionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          sessionId={childSessionId}
          title={description}
        />
      )}
    </>
  );
}
ToolRegistry.register('agent_message', AgentMessageTool);
ToolRegistry.register('agent-message', AgentMessageTool);

function AgentStopTool({ part }: ToolProps) {
  const input = partInput(part);
  const agentId = (input.agent_id as string) || '';
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 w-full overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <StopCircle className="size-4 text-muted-foreground flex-shrink-0" />
          <span className="text-[13px] font-medium text-foreground truncate flex-1">
            Agent stopped
          </span>
          {agentId && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">
              {agentId.slice(-12)}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60 bg-muted/60 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
            Stopped
          </span>
        </div>
      </div>
    </div>
  );
}
ToolRegistry.register('agent_stop', AgentStopTool);
ToolRegistry.register('agent-stop', AgentStopTool);

function AgentStatusTool({ part }: ToolProps) {
  const status = partStatus(part);
  const output = partOutput(part);
  const isRunning = status === 'running' || status === 'pending';
  const [expanded, setExpanded] = useState(false);

  // Try to parse worker count from output
  const workerCount = useMemo(() => {
    if (!output) return 0;
    const matches = output.match(/ag-[a-zA-Z0-9]+/g);
    return matches ? matches.length : 0;
  }, [output]);

  const cleanedOutput = useMemo(() => cleanWorkerOutput(output), [output]);

  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 w-full overflow-hidden">
      <div className="p-3">
        <div className="flex items-center gap-2.5">
          <Layers className="size-4 text-muted-foreground flex-shrink-0" />
          <span className="text-[13px] font-medium text-foreground truncate flex-1">
            Agent status
          </span>
          {isRunning && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-medium flex-shrink-0 flex items-center gap-1">
              <Loader2 className="size-2.5 animate-spin" />
              Checking
            </span>
          )}
          {!isRunning && workerCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono flex-shrink-0">
              {workerCount} agent{workerCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Details section */}
      {!isRunning && cleanedOutput && (
        <div className="border-t border-border/30">
          {isShortOutput(cleanedOutput) ? (
            /* Short output: show inline, no collapse */
            <div className="px-3 py-2.5">
              <div className="text-xs text-foreground/80 leading-relaxed border-l-2 border-border/40 pl-3 prose-sm [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_table]:text-[11px] [&_code]:text-[11px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_hr]:border-border/30 [&_hr]:my-3">
                <UnifiedMarkdown content={cleanedOutput} isStreaming={false} />
              </div>
            </div>
          ) : (
            /* Long output: collapsible */
            <>
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer hover:bg-muted/30 transition-colors"
              >
                <ChevronRight
                  className={cn(
                    'size-3 text-muted-foreground/60 transition-transform flex-shrink-0',
                    expanded && 'rotate-90',
                  )}
                />
                <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0">
                  Details
                </span>
              </button>
              {expanded && (
                <div
                  data-scrollable
                  className="px-3 pb-3 max-h-80 overflow-y-auto"
                >
                  <div className="text-xs text-foreground/80 leading-relaxed border-l-2 border-border/40 pl-3 prose-sm [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-xs [&_h3]:font-medium [&_h3]:text-foreground [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_table]:text-[11px] [&_code]:text-[11px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:rounded [&_hr]:border-border/30 [&_hr]:my-3">
                    <UnifiedMarkdown
                      content={cleanedOutput}
                      isStreaming={false}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
ToolRegistry.register('agent_status', AgentStatusTool);
