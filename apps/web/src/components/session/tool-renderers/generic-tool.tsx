'use client';

import React, { useContext, useMemo } from 'react';
import { Cpu, Loader2 } from 'lucide-react';
import {
  hasStructuredContent,
  normalizeToolOutput,
  parseStructuredOutput,
} from '@/lib/utils/structured-output';
import {
  type ToolProps,
  partOutput,
  ToolOutputFallback,
  BasicTool,
  ToolRunningContext,
  StructuredOutput,
} from './shared';
import { stripAnsi } from '@/ui';

// ============================================================================
// GenericTool (fallback)
// ============================================================================

/**
 * Parse a tool name that may contain a namespace/server prefix.
 * e.g. "marko-kraemer/validate-slide" -> { server: "marko-kraemer", name: "validate-slide", display: "Validate Slide" }
 * e.g. "bash" -> { server: null, name: "bash", display: "Bash" }
 */
function parseToolName(tool: string): {
  server: string | null;
  name: string;
  display: string;
} {
  const slashIdx = tool.lastIndexOf('/');
  const server = slashIdx > 0 ? tool.slice(0, slashIdx) : null;
  const name = slashIdx > 0 ? tool.slice(slashIdx + 1) : tool;
  // Convert kebab/snake case to Title Case
  const display = name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { server, name, display };
}

export function GenericTool({ part }: ToolProps) {
  const output = partOutput(part);
  const strippedGenericOutput = output ? stripAnsi(output) : '';
  const running = useContext(ToolRunningContext);
  const { server, display } = useMemo(
    () => parseToolName(part.tool),
    [part.tool],
  );

  // Try to detect structured log-like output (warnings, tracebacks, etc.)
  const genericStructuredSections = useMemo(() => {
    if (!strippedGenericOutput) return null;
    const normalized = normalizeToolOutput(strippedGenericOutput);
    if (!hasStructuredContent(normalized)) return null;
    return parseStructuredOutput(normalized);
  }, [strippedGenericOutput]);

  // Build trigger title with optional server badge
  const triggerNode = (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <span className="font-medium text-xs text-foreground whitespace-nowrap">
        {display}
      </span>
      {server && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground/70 font-mono whitespace-nowrap">
          {server}
        </span>
      )}
      {genericStructuredSections && (
        <span className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono whitespace-nowrap">
          {genericStructuredSections[0]?.type}
        </span>
      )}
      {running && (
        <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto flex-shrink-0" />
      )}
    </div>
  );

  const bodyContent = genericStructuredSections ? (
    <div className="p-2.5 max-h-72 overflow-auto">
      <StructuredOutput sections={genericStructuredSections} />
    </div>
  ) : output ? (
    <ToolOutputFallback output={output} toolName={part.tool} />
  ) : null;

  return (
    <BasicTool
      icon={<Cpu className="size-3.5 flex-shrink-0" />}
      trigger={triggerNode}
    >
      {bodyContent}
    </BasicTool>
  );
}
