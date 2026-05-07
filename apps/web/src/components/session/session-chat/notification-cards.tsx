'use client';

import { useState } from 'react';
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  Layers,
  Loader2,
  MessageSquare,
  Scissors,
  Terminal,
} from 'lucide-react';
import { UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type {
  AgentCompletedNotification,
  DCPNotification,
  PtyExitedNotification,
} from './types';
import { formatDCPTokens } from './utils';
import type { ToolPart } from '@/ui';

// ============================================================================
// DCP reason labels
// ============================================================================

const DCP_REASON_LABELS: Record<string, string> = {
  completion: 'Task Complete',
  noise: 'Noise Removal',
  extraction: 'Extraction',
};

// ============================================================================
// Answered question card — collapsible summary of completed Q&A
// ============================================================================

export function AnsweredQuestionCard({
  part,
  defaultExpanded = false,
}: {
  part: ToolPart;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const input = (part.state as any)?.input ?? {};
  const metadata = (part.state as any)?.metadata ?? {};
  const questions: Array<{
    question: string;
    options?: { label: string }[];
  }> = Array.isArray(input.questions) ? input.questions : [];
  const answers: string[][] = Array.isArray(metadata.answers)
    ? metadata.answers
    : [];
  if (questions.length === 0 || answers.length === 0) return null;

  const answeredCount = answers.filter((a) => a.length > 0).length;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="flex items-center gap-1.5 w-full px-2.5 py-1.5 h-auto text-left rounded-none justify-start hover:bg-muted/40"
          >
            <MessageSquare className="size-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-foreground">
              Questions
            </span>
            <span className="text-[11px] text-muted-foreground/70">
              {answeredCount} answered
            </span>
            <ChevronDown
              className={cn(
                'size-3 text-muted-foreground ml-auto transition-transform',
                expanded && 'rotate-180',
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/30">
            {questions.map((q, i) => {
              const answer = answers[i] || [];
              const answerText = answer.join(', ') || 'No answer';
              return (
                <div
                  key={i}
                  className="px-2.5 py-2 border-b border-border/30 last:border-b-0"
                >
                  <div className="[&_*]:!text-muted-foreground/70 [&_p]:!my-0 [&_p]:!leading-relaxed [&_p]:!text-[11px] [&_ul]:!my-0 [&_ol]:!my-0 [&_li]:!my-0 [&_code]:!text-[10px] [&_strong]:!text-muted-foreground/60">
                    <UnifiedMarkdown content={q.question} />
                  </div>
                  <div className="text-sm font-medium text-foreground mt-0.5">
                    {answerText}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ============================================================================
// DCP Notification Card — styled component for pruning/compress events
// ============================================================================

export function DCPNotificationCard({
  notification,
}: {
  notification: DCPNotification;
}) {
  const [expanded, setExpanded] = useState(false);
  const isPrune = notification.type === 'prune';
  const hasItems = notification.items.length > 0;
  const hasDetails = hasItems || notification.distilled || notification.summary;

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      {/* Header */}
      <Button
        onClick={() => hasDetails && setExpanded(!expanded)}
        variant="ghost"
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 h-auto border-b border-border/40 bg-muted/30 rounded-none justify-start',
          !hasDetails && 'pointer-events-none',
        )}
      >
        <Scissors className="size-3.5 text-muted-foreground/70 flex-shrink-0" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {isPrune ? 'Context Pruned' : 'Context Compressed'}
        </span>

        {/* Stats pills */}
        <div className="flex items-center gap-1.5 ml-auto">
          {notification.reason && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70">
              {DCP_REASON_LABELS[notification.reason] || notification.reason}
            </span>
          )}
          {isPrune && notification.prunedCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium">
              {notification.prunedCount} pruned
            </span>
          )}
          {!isPrune &&
            notification.messagesCount &&
            notification.messagesCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                {notification.messagesCount} msgs
              </span>
            )}
          {notification.batchSaved > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
              -{formatDCPTokens(notification.batchSaved)} tokens
            </span>
          )}
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {formatDCPTokens(notification.tokensSaved)} saved
          </span>
          {hasDetails && (
            <ChevronDown
              className={cn(
                'size-3 text-muted-foreground/50 transition-transform',
                expanded && 'rotate-180',
              )}
            />
          )}
        </div>
      </Button>

      {/* Expandable details */}
      {expanded && hasDetails && (
        <div className="px-3 py-2 space-y-2">
          {/* Pruned items list */}
          {hasItems && (
            <div className="space-y-0.5">
              {notification.items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11px] text-muted-foreground/80"
                >
                  <span className="text-muted-foreground/60">&rarr;</span>
                  <span className="font-mono text-[10px] px-1 py-0.5 rounded bg-muted/50 text-muted-foreground/70">
                    {item.tool}
                  </span>
                  {item.description && (
                    <span className="truncate max-w-[300px]">
                      {item.description}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Compress topic */}
          {notification.topic && (
            <div className="text-[11px] text-muted-foreground/80">
              <span className="text-muted-foreground/50">Topic:</span>{' '}
              <span>{notification.topic}</span>
            </div>
          )}

          {/* Distilled content */}
          {notification.distilled && (
            <div className="mt-1.5 border-t border-border/30 pt-1.5">
              <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                Distilled
              </div>
              <div className="text-[11px] text-muted-foreground/80 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {notification.distilled}
              </div>
            </div>
          )}

          {/* Compress summary */}
          {notification.summary && (
            <div className="mt-1.5 border-t border-border/30 pt-1.5">
              <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                Summary
              </div>
              <div className="text-[11px] text-muted-foreground/80 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                {notification.summary}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PTY Exited Notification Card
// ============================================================================

export function PtyExitedNotificationCard({
  notification,
}: {
  notification: PtyExitedNotification;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
        <Terminal className="size-3.5 text-muted-foreground/70 flex-shrink-0" />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          Automated PTY response
        </span>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
        {notification.description && (
          <div>
            <span className="text-muted-foreground/60">Description:</span>{' '}
            {notification.description}
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {notification.id && (
            <span>
              <span className="text-muted-foreground/60">ID:</span>{' '}
              {notification.id}
            </span>
          )}
          {notification.exitCode && (
            <span>
              <span className="text-muted-foreground/60">Exit:</span>{' '}
              {notification.exitCode}
            </span>
          )}
          {notification.outputLines && (
            <span>
              <span className="text-muted-foreground/60">Lines:</span>{' '}
              {notification.outputLines}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Completed Notification Card
// ============================================================================

export function AgentCompletedNotificationCard({
  notification,
}: {
  notification: AgentCompletedNotification;
}) {
  const statusColor =
    notification.status === 'completed'
      ? 'text-emerald-600 dark:text-emerald-400'
      : notification.status === 'failed'
        ? 'text-destructive'
        : 'text-amber-600 dark:text-amber-400';

  const headerLabel =
    notification.status === 'failed'
      ? 'Agent failed'
      : notification.status === 'stopped'
        ? 'Agent stopped'
        : 'Agent completed';

  return (
    <div className="rounded-lg border border-border/60 bg-card/50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
        <Cpu
          className={cn(
            'size-3.5 flex-shrink-0',
            notification.status === 'failed'
              ? 'text-destructive/70'
              : notification.status === 'stopped'
                ? 'text-amber-500/70'
                : 'text-muted-foreground/70',
          )}
        />
        <span className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
          {headerLabel}
        </span>
        {notification.status && (
          <span className={cn('text-[10px] ml-auto font-medium', statusColor)}>
            {notification.status}
          </span>
        )}
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground space-y-1">
        {notification.task && (
          <div>
            <span className="text-muted-foreground/60">Task:</span>{' '}
            {notification.task}
          </div>
        )}
        {notification.error && (
          <div className="text-destructive/80">
            <span className="text-muted-foreground/60">Error:</span>{' '}
            <span className="font-mono text-[11px]">
              {notification.error.slice(0, 200)}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {notification.agentId && (
            <span>
              <span className="text-muted-foreground/60">Agent:</span>{' '}
              <span className="font-mono">{notification.agentId}</span>
            </span>
          )}
          {notification.sessionId && (
            <span>
              <span className="text-muted-foreground/60">Session:</span>{' '}
              <span className="font-mono">{notification.sessionId}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
