'use client';

import { useEffect, useState } from 'react';
import { Brain, ChevronRight, Loader2 } from 'lucide-react';
import { UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { formatDuration } from '@/ui';
import type { ReasoningPart } from '@/ui';
import { trimIncompleteTableRow, closeUnterminatedCodeFence } from './utils';

// ============================================================================
// Throttled Markdown — limits re-renders during streaming (~30fps)
// ============================================================================

export function ThrottledMarkdown({
  content,
  isStreaming,
}: {
  content: string;
  isStreaming: boolean;
}) {
  const displayContent = isStreaming
    ? closeUnterminatedCodeFence(trimIncompleteTableRow(content))
    : content;
  return <UnifiedMarkdown content={displayContent} isStreaming={isStreaming} />;
}

// ============================================================================
// Reasoning Part Card — collapsible reasoning display
// ============================================================================

export function ReasoningPartCard({
  part,
  isStreaming,
}: {
  part: ReasoningPart;
  isStreaming: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [streamSeconds, setStreamSeconds] = useState(0);
  const start = (part as any).time?.start;
  const end = (part as any).time?.end;
  const reasoningStreaming =
    isStreaming && !(typeof end === 'number' && end > 0);

  useEffect(() => {
    if (!reasoningStreaming) {
      setStreamSeconds(0);
      return;
    }
    if (typeof start !== 'number') {
      setStreamSeconds(0);
      return;
    }
    const update = () => {
      setStreamSeconds(Math.max(0, Math.round((Date.now() - start) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [reasoningStreaming, start]);

  const text = part.text?.trim();
  if (!text) return null;

  const hasDuration =
    typeof start === 'number' && typeof end === 'number' && end > start;
  const duration = hasDuration ? formatDuration(end - start) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
            'bg-muted/20 border border-border/40',
            'text-xs transition-colors select-none',
            'cursor-pointer hover:bg-muted/40',
            'max-w-full group',
          )}
        >
          {/* Icon */}
          <span className="flex-shrink-0">
            <Brain
              className={cn(
                'size-3.5 text-muted-foreground/65',
                reasoningStreaming && 'animate-pulse-heartbeat',
              )}
            />
          </span>

          {/* Title + duration */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-medium text-xs text-foreground whitespace-nowrap">
              Reasoning
            </span>
            {reasoningStreaming ? (
              <span className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono whitespace-nowrap">
                {streamSeconds}s
              </span>
            ) : duration ? (
              <span className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono whitespace-nowrap">
                {duration}
              </span>
            ) : null}
          </div>

          {/* Right side: spinner when streaming, chevron */}
          {reasoningStreaming && (
            <Loader2 className="size-3 animate-spin text-muted-foreground/40 flex-shrink-0" />
          )}
          <ChevronRight
            className={cn(
              'size-3 transition-transform flex-shrink-0 text-muted-foreground/50',
              open && 'rotate-90',
            )}
          />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-1.5 mb-2 rounded-lg bg-muted/20 border border-border/30 text-xs overflow-hidden">
          <div className="p-3 text-muted-foreground/65 [&_.aether-markdown]:italic [&_.aether-markdown_div]:!text-[13px] [&_.aether-markdown_div]:!leading-[1.45] [&_.aether-markdown_div]:!text-muted-foreground/65 [&_.aether-markdown_li]:!text-[13px] [&_.aether-markdown_li]:!leading-[1.45] [&_.aether-markdown_li]:!text-muted-foreground/65 [&_.aether-markdown_strong]:!text-muted-foreground/70 [&_.aether-markdown_em]:!text-muted-foreground/70">
            <ThrottledMarkdown content={part.text} isStreaming={false} />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
