'use client';

import React, { useState, useMemo } from 'react';
import { Ban, ChevronRight, CircleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  hasStructuredContent,
  normalizeToolOutput,
  parseStructuredOutput,
} from '@/lib/utils/structured-output';
import { StructuredOutput } from './shared';

// ============================================================================
// ToolError
// ============================================================================

/**
 * A parsed Zod/JSON validation error issue.
 */
interface ValidationIssue {
  code: string;
  message: string;
  path: string[];
  values?: string[];
}

/**
 * Parse an error string into a summary line and optional traceback/details.
 */
function parseErrorContent(error: string): {
  summary: string;
  traceback: string | null;
  errorType: string | null;
  validationIssues: ValidationIssue[] | null;
} {
  const cleaned = error.replace(/^Error:\s*/, '');

  // Try to detect JSON validation errors (Zod-style arrays of issues)
  const trimmed = cleaned.trim();
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      // Check if it looks like validation issues (has code + message fields)
      if (
        arr.length > 0 &&
        arr.every(
          (item: any) => item && typeof item === 'object' && 'message' in item,
        )
      ) {
        const issues: ValidationIssue[] = arr.map((item: any) => ({
          code: item.code || 'error',
          message: item.message || String(item),
          path: Array.isArray(item.path) ? item.path.map(String) : [],
          values: Array.isArray(item.values)
            ? item.values.map(String)
            : undefined,
        }));
        // Build a readable summary from the first issue
        const first = issues[0];
        const pathStr = first.path.length > 0 ? first.path.join('.') : '';
        const summary = pathStr
          ? `${pathStr}: ${first.message}`
          : first.message;
        return {
          summary,
          traceback: null,
          errorType: 'Validation Error',
          validationIssues: issues,
        };
      }
    } catch {
      // Not valid JSON — fall through to other detection methods
    }
  }

  // Try to extract Python-style traceback
  const tracebackIdx = cleaned.indexOf('Traceback (most recent call last):');
  if (tracebackIdx >= 0) {
    const before = cleaned.slice(0, tracebackIdx).trim();
    const traceSection = cleaned.slice(tracebackIdx);
    // Find the actual error line at the end (last line that isn't whitespace)
    const lines = traceSection.split('\n').filter((l) => l.trim());
    const lastLine = lines[lines.length - 1] || '';
    // Extract error type (e.g. "playwright._impl._errors.Error")
    const typeMatch = lastLine.match(
      /^([\w._]+(?:Error|Exception|Warning)):\s*/,
    );
    const errorType = typeMatch
      ? typeMatch[1].split('.').pop() || typeMatch[1]
      : null;
    const summary = before || (errorType ? lastLine : lastLine.slice(0, 120));
    return {
      summary,
      traceback: traceSection,
      errorType,
      validationIssues: null,
    };
  }

  // Try to extract Node.js-style stack trace
  const stackIdx = cleaned.indexOf('\n    at ');
  if (stackIdx >= 0) {
    const summary = cleaned.slice(0, stackIdx).trim();
    return {
      summary,
      traceback: cleaned.slice(stackIdx),
      errorType: null,
      validationIssues: null,
    };
  }

  // Simple "ErrorType: message" pattern
  const colonIdx = cleaned.indexOf(': ');
  if (colonIdx > 0 && colonIdx < 60) {
    const left = cleaned.slice(0, colonIdx);
    if (/^[\w._-]+$/.test(left)) {
      return {
        summary: cleaned,
        traceback: null,
        errorType: left,
        validationIssues: null,
      };
    }
  }

  return {
    summary: cleaned,
    traceback: null,
    errorType: null,
    validationIssues: null,
  };
}

export function ToolError({
  error,
  toolName,
}: {
  error: string;
  toolName?: string;
}) {
  const [showTrace, setShowTrace] = useState(false);

  // Normalize and try structured rendering
  const structuredSections = useMemo(() => {
    const normalized = normalizeToolOutput(error);
    if (!hasStructuredContent(normalized)) return null;
    return parseStructuredOutput(normalized);
  }, [error]);

  const { summary, traceback, errorType, validationIssues } = useMemo(
    () => parseErrorContent(normalizeToolOutput(error)),
    [error],
  );

  // Display name: prefer short error type, else "Error"
  const displayType = errorType || 'Error';

  // Use structured output when we detect warnings + tracebacks etc.
  if (structuredSections) {
    return (
      <div className="text-xs">
        <StructuredOutput sections={structuredSections} />
      </div>
    );
  }

  // Render validation issues with structured layout
  if (validationIssues && validationIssues.length > 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
          <Ban className="size-3 flex-shrink-0 text-muted-foreground/70" />
          <span className="font-medium text-muted-foreground">
            {displayType}
          </span>
          {toolName && (
            <span className="text-muted-foreground/50 font-mono text-[10px] ml-auto">
              {toolName}
            </span>
          )}
        </div>

        {/* Validation issues */}
        <div className="px-3 py-2.5 space-y-2.5">
          {validationIssues.map((issue, i) => (
            <div key={i} className="space-y-1.5">
              {/* Path + message */}
              <div className="flex items-start gap-2">
                <CircleAlert className="size-3 flex-shrink-0 text-muted-foreground/60 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {issue.path.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground/70 font-mono mr-1.5">
                      {issue.path.join('.')}
                    </span>
                  )}
                  <span className="text-foreground/80 text-[11px]">
                    {issue.message}
                  </span>
                </div>
              </div>

              {/* Valid values */}
              {issue.values && issue.values.length > 0 && (
                <div className="ml-5">
                  <div className="text-[10px] text-muted-foreground/50 mb-1">
                    Expected one of:
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {issue.values.map((val, vi) => (
                      <span
                        key={vi}
                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/40 text-muted-foreground/70 font-mono"
                      >
                        {val}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 overflow-hidden text-xs">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <Ban className="size-3 flex-shrink-0 text-muted-foreground/70" />
        <span className="font-medium text-muted-foreground">{displayType}</span>
        {toolName && (
          <span className="text-muted-foreground/50 font-mono text-[10px] ml-auto">
            {toolName}
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="px-3 py-2.5">
        <p className="text-foreground/80 leading-relaxed break-words whitespace-pre-wrap font-mono text-[11px]">
          {summary}
        </p>
      </div>

      {/* Stack trace toggle */}
      {traceback && (
        <>
          <button
            onClick={() => setShowTrace((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 w-full text-left border-t border-border/40 text-muted-foreground/60 hover:text-muted-foreground transition-colors cursor-pointer"
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform',
                showTrace && 'rotate-90',
              )}
            />
            <span className="text-[10px] font-medium">Stack trace</span>
          </button>
          {showTrace && (
            <div className="px-3 pb-2.5 max-h-64 overflow-auto">
              <pre className="font-mono text-[10px] leading-relaxed text-muted-foreground/60 whitespace-pre-wrap break-all">
                {traceback}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}
