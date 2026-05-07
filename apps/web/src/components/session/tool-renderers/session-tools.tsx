'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Check,
  Clock,
  CircleAlert,
  Cpu,
  ExternalLink,
  Glasses,
  Layers,
  ListTree,
  Loader2,
  MessageCircle,
  Search,
  Trash2,
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
  ToolEmptyState,
  ToolOutputFallback,
  BasicTool,
  ToolRunningContext,
} from './shared';
import {
  getChildSessionId,
  getChildSessionToolParts,
  getToolInfo,
} from '@/ui';

// ============================================================================
// SessionSpawnTool — Background session spawning
// IDENTICAL to TaskTool UX: compact clickable card, live activity shimmer,
// step count badge, SubSessionModal on click.
// ============================================================================

function SessionSpawnTool({ part, forceOpen }: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);

  const agentName = (input.agent as string) || 'aether';
  const description = (input.description as string) || '';
  const projectName = (input.project as string) || '';
  const fullPrompt = (input.prompt as string) || '';

  // Extract child session ID from output text
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

  const isRunning = status === 'running' || status === 'pending';
  const isCompleted = status === 'completed';

  // Running: show last active tool as shimmer subtitle
  const lastActivity = useMemo(() => {
    if (childToolParts.length === 0) return null;
    const last = childToolParts[childToolParts.length - 1];
    const info = getToolInfo(last.tool, partInput(last) as Record<string, any>);
    return info.title + (info.subtitle ? ` · ${info.subtitle}` : '');
  }, [childToolParts]);

  const running = useContext(ToolRunningContext);

  // Label: project name or description or first line of prompt
  const label =
    description || projectName || fullPrompt.split('\n')[0]?.slice(0, 80) || '';

  return (
    <>
      {/* Clickable card — identical to TaskTool */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => childSessionId && setModalOpen(true)}
        onKeyDown={(e) =>
          e.key === 'Enter' && childSessionId && setModalOpen(true)
        }
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
          'bg-muted/20 border border-border/40',
          'text-xs transition-colors select-none',
          childSessionId
            ? 'cursor-pointer hover:bg-muted/40'
            : 'cursor-default',
          'max-w-full group',
        )}
      >
        {/* Icon */}
        <Cpu className="size-3.5 flex-shrink-0 text-muted-foreground" />

        {/* Title + subtitle */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Worker · {agentName}
          </span>

          {isRunning && lastActivity ? (
            <TextShimmer
              duration={1}
              spread={2}
              className="text-xs truncate font-mono"
            >
              {lastActivity}
            </TextShimmer>
          ) : isRunning && label ? (
            <TextShimmer
              duration={1}
              spread={2}
              className="text-xs truncate font-mono"
            >
              {label}
            </TextShimmer>
          ) : label ? (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {label}
            </span>
          ) : null}

          {/* Step count badge when done */}
          {isCompleted && childToolParts.length > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 font-mono whitespace-nowrap flex-shrink-0">
              {childToolParts.length} steps
            </span>
          )}
        </div>

        {/* Right side */}
        {running && (
          <Loader2 className="size-3 animate-spin text-muted-foreground/60 flex-shrink-0" />
        )}
        {childSessionId && !running && (
          <ExternalLink className="size-3 flex-shrink-0 text-muted-foreground/60 group-hover:text-muted-foreground/60 transition-colors" />
        )}
      </div>

      {/* Modal */}
      {childSessionId && (
        <SubSessionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          sessionId={childSessionId}
          title={`Worker · ${agentName}${label ? `: ${label}` : ''}`}
        />
      )}
    </>
  );
}
ToolRegistry.register('session_spawn', SessionSpawnTool);
ToolRegistry.register('session_start_background', SessionSpawnTool);
ToolRegistry.register('session-start-background', SessionSpawnTool);
ToolRegistry.register('session-spawn', SessionSpawnTool);

// ============================================================================
// SessionReadTool — structured session read with parsed metadata
// ============================================================================

function SessionReadTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const sessionId = (input.session_id as string) || '';
  const mode = (input.mode as string) || 'summary';
  const pattern = (input.pattern as string) || '';
  const sid = sessionId.length > 16 ? `…${sessionId.slice(-12)}` : sessionId;
  const modeLabel =
    mode === 'tools'
      ? 'tools'
      : mode === 'full'
        ? 'full'
        : mode === 'search'
          ? 'search'
          : 'summary';

  // Parse structured metadata from output
  const parsed = useMemo(() => {
    if (!output) return null;
    const statusM = output.match(/\*\*Status:\*\*\s*(\w+)/);
    const agentM = output.match(/\*\*Agent:\*\*\s*(\w+)/);
    const msgsM = output.match(/\*\*Messages:\*\*\s*(\d+)/);
    const toolsM = output.match(/\*\*Tool calls:\*\*\s*(\d+)/);
    const toolListM = output.match(/\*\*Tools:\*\*\s*(.+)/);
    return {
      status: statusM?.[1] || null,
      agent: agentM?.[1] || null,
      messages: msgsM?.[1] || null,
      toolCalls: toolsM?.[1] || null,
      toolList: toolListM?.[1]?.split(', ').map((t) => t.trim()) || [],
    };
  }, [output]);

  // Parse tool call entries for "tools" mode
  const toolEntries = useMemo(() => {
    if (mode !== 'tools' || !output) return [];
    const entries: Array<{ status: string; tool: string; summary: string }> =
      [];
    const re = /^\[(\w+)\]\s+\*\*(\w+)\*\*:\s*(.+)/gm;
    let m;
    while ((m = re.exec(output)) !== null) {
      entries.push({ status: m[1], tool: m[2], summary: m[3].slice(0, 120) });
    }
    return entries;
  }, [mode, output]);

  const statusArgs: string[] = [];
  if (parsed?.status) statusArgs.push(parsed.status);
  if (parsed?.messages) statusArgs.push(`${parsed.messages} msgs`);
  if (parsed?.toolCalls && parsed.toolCalls !== '0')
    statusArgs.push(`${parsed.toolCalls} tools`);
  if (mode === 'search' && pattern) statusArgs.push(`/${pattern}/`);

  return (
    <BasicTool
      icon={<Glasses className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: `Session · ${modeLabel}`,
        subtitle: sid,
        args: statusArgs,
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {/* Tools mode: render structured tool call list */}
      {mode === 'tools' && toolEntries.length > 0 ? (
        <div data-scrollable className="max-h-72 overflow-auto">
          {toolEntries.map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-0 border-b last:border-b-0 border-border/10"
            >
              <span className="text-[10px] font-mono w-6 text-center py-1 flex-shrink-0 select-none">
                {entry.status === 'completed' ? (
                  <Check className="size-2.5 text-emerald-500 inline" />
                ) : entry.status === 'pending' ? (
                  <Clock className="size-2.5 text-muted-foreground/50 inline" />
                ) : (
                  <CircleAlert className="size-2.5 text-red-400 inline" />
                )}
              </span>
              <span className="text-[10px] font-mono text-foreground/80 font-medium w-24 py-1 flex-shrink-0 truncate">
                {entry.tool}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground/60 py-1 pr-2 truncate">
                {entry.summary}
              </span>
            </div>
          ))}
        </div>
      ) : output ? (
        <div data-scrollable className="max-h-72 overflow-auto px-3 py-2">
          <div className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
            <UnifiedMarkdown content={output} isStreaming={false} />
          </div>
        </div>
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('session_read', SessionReadTool);
ToolRegistry.register('session-read', SessionReadTool);

// ============================================================================
// SessionSearchTool — structured search results with hit list
// ============================================================================

function SessionSearchTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const query = (input.query as string) || '';

  // Parse search hits
  const hits = useMemo(() => {
    if (!output) return [];
    const results: Array<{
      id: string;
      title: string;
      updated: string;
      score: string;
      snippet: string;
    }> = [];
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(
        /^(ses_\S+)\s*\|\s*"([^"]*)"\s*\|\s*(\S+.*?)\s*\|\s*score=(\d+)/,
      );
      if (m) {
        const snippetLine = lines[i + 1]?.match(/^Snippet:\s*(.+)/);
        results.push({
          id: m[1],
          title: m[2],
          updated: m[3].trim(),
          score: m[4],
          snippet: snippetLine?.[1]?.trim() || '',
        });
      }
    }
    return results;
  }, [output]);

  const noResults = status === 'completed' && hits.length === 0;

  return (
    <BasicTool
      icon={<Search className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Session Search',
        subtitle: query ? `"${query}"` : '',
        args:
          hits.length > 0
            ? [`${hits.length} results`]
            : noResults
              ? ['no matches']
              : [],
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {hits.length > 0 ? (
        <div
          data-scrollable
          className="max-h-72 overflow-auto divide-y divide-border/20"
        >
          {hits.map((h) => (
            <div
              key={h.id}
              className="px-3 py-2 hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-medium text-foreground truncate flex-1">
                  {h.title || '(untitled)'}
                </span>
                <span className="text-[0.5625rem] font-mono text-muted-foreground/60 bg-muted/40 px-1 rounded flex-shrink-0">
                  {h.score}
                </span>
              </div>
              {h.snippet && (
                <p className="text-[10px] text-muted-foreground/60 line-clamp-1">
                  {h.snippet}
                </p>
              )}
              <div className="flex items-center gap-2 text-[0.5625rem] text-muted-foreground/60 mt-0.5">
                <span className="font-mono">{h.id.slice(-12)}</span>
                <span>{h.updated}</span>
              </div>
            </div>
          ))}
        </div>
      ) : noResults ? (
        <ToolEmptyState message={`No sessions matched "${query}"`} />
      ) : output ? (
        <ToolOutputFallback output={output} toolName="session_search" />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('session_search', SessionSearchTool);
ToolRegistry.register('session-search', SessionSearchTool);

// ============================================================================
// SessionMessageTool — message sent indicator
// ============================================================================

function SessionMessageTool({ part }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const sessionId = (input.session_id as string) || '';
  const message = (input.message as string) || '';
  const sid = sessionId.length > 16 ? `…${sessionId.slice(-12)}` : sessionId;
  const isOk = status === 'completed';

  return (
    <BasicTool
      icon={<MessageCircle className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Message → Session',
        subtitle: sid,
        args: isOk ? ['sent'] : status === 'error' ? ['failed'] : [],
      }}
      defaultOpen={false}
    >
      {message && (
        <div className="px-3 py-2">
          <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">
            Message
          </div>
          <div className="text-[11px] text-foreground/70 whitespace-pre-wrap bg-muted/20 rounded p-2 border border-border/20">
            {message.slice(0, 500)}
          </div>
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('session_message', SessionMessageTool);
ToolRegistry.register('session-message', SessionMessageTool);

// ============================================================================
// SessionLineageTool — tree visualization
// ============================================================================

function SessionLineageTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const sessionId = (input.session_id as string) || '';
  const sid = sessionId.length > 16 ? `…${sessionId.slice(-12)}` : sessionId;

  // Count sessions in lineage
  const sessionCount = useMemo(() => {
    if (!output) return 0;
    return (output.match(/ses_/g) || []).length;
  }, [output]);

  return (
    <BasicTool
      icon={<ListTree className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Session Lineage',
        subtitle: sid,
        args: sessionCount > 0 ? [`${sessionCount} sessions`] : [],
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {output ? (
        <div data-scrollable className="max-h-56 overflow-auto px-3 py-2">
          <div className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
            <UnifiedMarkdown content={output} isStreaming={false} />
          </div>
        </div>
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('session_lineage', SessionLineageTool);
ToolRegistry.register('session-lineage', SessionLineageTool);

// ============================================================================
// SessionStatsTool
// ============================================================================

function SessionStatsTool({ part }: ToolProps) {
  const output = partOutput(part);

  return (
    <BasicTool
      icon={<Layers className="size-3.5 flex-shrink-0" />}
      trigger={{ title: 'Session Stats', subtitle: '', args: [] }}
      defaultOpen={true}
    >
      {output && (
        <div data-scrollable className="max-h-72 overflow-auto px-3 py-2">
          <div className="text-[11px] font-mono text-foreground whitespace-pre-wrap">
            <UnifiedMarkdown content={output} isStreaming={false} />
          </div>
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('session_stats', SessionStatsTool);
ToolRegistry.register('session-stats', SessionStatsTool);

// ============================================================================
// SessionListBackgroundTool — structured worker list
// ============================================================================

function SessionListBackgroundTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const project = (input.project as string) || '';

  // Parse worker entries
  const workers = useMemo(() => {
    if (!output) return [];
    const entries: Array<{
      id: string;
      status: string;
      project: string;
      prompt: string;
    }> = [];
    const re = /\*\*(ses_\S+)\*\*.*?status:\s*(\w+).*?project:\s*(\S+)/gi;
    let m;
    while ((m = re.exec(output)) !== null) {
      entries.push({ id: m[1], status: m[2], project: m[3], prompt: '' });
    }
    return entries;
  }, [output]);

  const noWorkers =
    status === 'completed' && workers.length === 0 && !output.includes('ses_');

  return (
    <BasicTool
      icon={<Layers className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Background Sessions',
        subtitle: project || 'all projects',
        args:
          workers.length > 0
            ? [`${workers.length} workers`]
            : noWorkers
              ? ['none']
              : [],
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {workers.length > 0 ? (
        <div
          data-scrollable
          className="max-h-56 overflow-auto divide-y divide-border/20"
        >
          {workers.map((w) => (
            <div key={w.id} className="flex items-center gap-2 px-3 py-1.5">
              <span
                className={cn(
                  'size-1.5 rounded-full flex-shrink-0',
                  w.status === 'running'
                    ? 'bg-blue-400'
                    : w.status === 'complete'
                      ? 'bg-emerald-400'
                      : 'bg-muted-foreground/30',
                )}
              />
              <span className="text-[10px] font-mono text-foreground/70 truncate">
                {w.id.slice(-12)}
              </span>
              <span className="text-[10px] text-muted-foreground/50 truncate flex-1">
                {w.project}
              </span>
              <span className="text-[0.5625rem] text-muted-foreground/60">
                {w.status}
              </span>
            </div>
          ))}
        </div>
      ) : output ? (
        <div data-scrollable className="max-h-56 overflow-auto px-3 py-2">
          <div className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap">
            <UnifiedMarkdown content={output} isStreaming={false} />
          </div>
        </div>
      ) : noWorkers ? (
        <ToolEmptyState message="No background sessions" />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('session_list_background', SessionListBackgroundTool);
ToolRegistry.register('session-list-background', SessionListBackgroundTool);
ToolRegistry.register('session_list_spawned', SessionListBackgroundTool);
ToolRegistry.register('session-list-spawned', SessionListBackgroundTool);

// ============================================================================
// ProjectDeleteTool
// ============================================================================

function ProjectDeleteTool({ part }: ToolProps) {
  const input = partInput(part);
  const project = (input.project as string) || '';
  return (
    <div className="flex items-center gap-2 px-2.5 py-1 text-xs text-muted-foreground/60">
      <Trash2 className="size-3 flex-shrink-0" />
      <span>Deleted {project}</span>
    </div>
  );
}
ToolRegistry.register('project_delete', ProjectDeleteTool);
ToolRegistry.register('project-delete', ProjectDeleteTool);
ToolRegistry.register('oc-project_delete', ProjectDeleteTool);
ToolRegistry.register('oc-project-delete', ProjectDeleteTool);
