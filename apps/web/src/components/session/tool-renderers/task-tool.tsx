'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  ExternalLink,
  Loader2,
  SquareKanban,
} from 'lucide-react';
import { SubSessionModal } from '@/components/session/sub-session-modal';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { useOpenCodeMessages } from '@/hooks/opencode/use-opencode-sessions';
import { cn } from '@/lib/utils';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partStatus,
  getAgentCardLabel,
  ToolRunningContext,
} from './shared';
import {
  getChildSessionId,
  getChildSessionToolParts,
  getToolInfo,
} from '@/ui';

// ============================================================================
// TaskTool — Sub-agent delegation
// ============================================================================

function TaskTool({ part, forceOpen }: ToolProps) {
  const input = partInput(part);
  const status = partStatus(part);

  const subagentType = (input.subagent_type as string) || 'general';
  const description = getAgentCardLabel(input);

  // Extract child session ID from metadata (available once task is running/completed)
  const childSessionId: string | undefined = useMemo(
    () => getChildSessionId(part),
    [part],
  );

  // Always load child messages — hook is stable even with empty string (returns nothing)
  const { data: childMessages } = useOpenCodeMessages(childSessionId ?? '');

  // Collect tool parts from child session for inline activity list
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

  return (
    <>
      {/* Clickable card — entire row opens modal */}
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
        <SquareKanban className="size-3.5 flex-shrink-0 text-muted-foreground" />

        {/* Title + subtitle */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Agent · {subagentType}
          </span>

          {isRunning && lastActivity ? (
            <TextShimmer
              duration={1}
              spread={2}
              className="text-xs truncate font-mono"
            >
              {lastActivity}
            </TextShimmer>
          ) : isRunning && description ? (
            <TextShimmer
              duration={1}
              spread={2}
              className="text-xs truncate font-mono"
            >
              {description}
            </TextShimmer>
          ) : description ? (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {description}
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
          <Loader2 className="size-3 animate-spin text-muted-foreground/40 flex-shrink-0" />
        )}
        {childSessionId && !running && (
          <ExternalLink className="size-3 flex-shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        )}
      </div>

      {/* Modal */}
      {childSessionId && (
        <SubSessionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          sessionId={childSessionId}
          title={`Agent · ${subagentType}${description ? `: ${description}` : ''}`}
        />
      )}
    </>
  );
}
ToolRegistry.register('task', TaskTool);
