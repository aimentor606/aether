'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Loader2,
  Scissors,
} from 'lucide-react';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partOutput,
  BasicTool,
  ToolRunningContext,
} from './shared';

// ============================================================================
// DCP Tools (distill, compress, prune, context_info)
// ============================================================================

function DCPPruneTool({ part }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const isRunning = useContext(ToolRunningContext);
  const ids = input.ids as string[] | undefined;
  const reason = input.reason as string | undefined;

  return (
    <BasicTool
      icon={<Scissors className="size-3.5 flex-shrink-0 text-amber-500" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Prune
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium whitespace-nowrap">
            DCP
          </span>
          {reason && (
            <span className="text-[10px] text-muted-foreground/70 truncate">
              {reason}
            </span>
          )}
          {ids && ids.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 ml-auto">
              {ids.length} tools
            </span>
          )}
          {isRunning && (
            <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>
      }
    >
      {output ? (
        <div data-scrollable className="p-2 max-h-48 overflow-auto">
          <pre className="font-mono text-[11px] whitespace-pre-wrap text-muted-foreground/60">
            {output}
          </pre>
        </div>
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('prune', DCPPruneTool);

function DCPDistillTool({ part }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const isRunning = useContext(ToolRunningContext);
  const ids = input.ids as string[] | undefined;

  return (
    <BasicTool
      icon={<Scissors className="size-3.5 flex-shrink-0 text-blue-500" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Distill
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium whitespace-nowrap">
            DCP
          </span>
          {ids && ids.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 ml-auto">
              {ids.length} tools
            </span>
          )}
          {isRunning && (
            <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>
      }
    >
      {output ? (
        <div data-scrollable className="p-2 max-h-48 overflow-auto">
          <pre className="font-mono text-[11px] whitespace-pre-wrap text-muted-foreground/60">
            {output}
          </pre>
        </div>
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('distill', DCPDistillTool);

function DCPCompressTool({ part }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const isRunning = useContext(ToolRunningContext);
  const topic = input.topic as string | undefined;

  return (
    <BasicTool
      icon={<Scissors className="size-3.5 flex-shrink-0 text-purple-500" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Compress
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-500 font-medium whitespace-nowrap">
            DCP
          </span>
          {topic && (
            <span className="text-[10px] text-muted-foreground/70 truncate max-w-[200px]">
              {topic}
            </span>
          )}
          {isRunning && (
            <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />
          )}
        </div>
      }
    >
      {output ? (
        <div data-scrollable className="p-2 max-h-48 overflow-auto">
          <pre className="font-mono text-[11px] whitespace-pre-wrap text-muted-foreground/60">
            {output}
          </pre>
        </div>
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('compress', DCPCompressTool);

function ContextInfoTool({ part }: ToolProps) {
  // context_info is a synthetic tool injected by DCP — render minimally or hide
  const output = partOutput(part);
  if (!output) return null;

  return (
    <BasicTool
      icon={
        <Scissors className="size-3.5 flex-shrink-0 text-muted-foreground/50" />
      }
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-muted-foreground/70 whitespace-nowrap">
            Context Info
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/50 font-medium whitespace-nowrap">
            DCP
          </span>
        </div>
      }
    >
      <div
        data-scrollable
        className="p-2 max-h-32 overflow-auto scrollbar-hide"
      >
        <pre className="font-mono text-[10px] whitespace-pre-wrap text-muted-foreground/60">
          {output}
        </pre>
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('context_info', ContextInfoTool);
