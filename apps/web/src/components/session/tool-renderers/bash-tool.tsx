'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Check,
  ExternalLink,
  Loader2,
  MessageCircle,
  Terminal,
  X,
} from 'lucide-react';
import { HighlightedCode, UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn } from '@/lib/utils';
import { hasStructuredContent, normalizeToolOutput, type OutputSection, parseStructuredOutput } from '@/lib/utils/structured-output';
import { useServerStore } from '@/stores/server-store';
import { openTabAndNavigate } from '@/stores/tab-store';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  MD_FLUSH_CLASSES,
  partStreamingInput,
  partInput,
  partMetadata,
  partOutput,
  partStatus,
  BasicTool,
  ToolRunningContext,
  StructuredOutput,
} from './shared';
import {
  stripAnsi,
} from '@/ui';

// --- Bash ---

/**
 * Try to pretty-print JSON output. Handles single JSON, arrays, and
 * mixed output with `===` section separators (e.g. reading multiple files).
 */
function formatBashOutput(rawOutput: string): {
  content: string;
  lang: string;
} {
  const trimmed = rawOutput.trim();
  if (!trimmed) return { content: '', lang: 'bash' };

  // Try single JSON parse and pretty-print
  try {
    const parsed = JSON.parse(trimmed);
    return { content: JSON.stringify(parsed, null, 2), lang: 'json' };
  } catch {
    /* not a single JSON blob */
  }

  // Check if it's a multi-section output (=== separators with JSON blocks)
  if (trimmed.includes('===') && trimmed.includes('{')) {
    const sections = trimmed.split(/^(={2,}\s.*)/m);
    let hasJson = false;
    const formatted = sections
      .map((section) => {
        const st = section.trim();
        if (!st) return '';
        if (/^={2,}\s/.test(st)) return st;
        try {
          const parsed = JSON.parse(st);
          hasJson = true;
          return JSON.stringify(parsed, null, 2);
        } catch {
          return st;
        }
      })
      .filter(Boolean)
      .join('\n\n');
    if (hasJson) return { content: formatted, lang: 'json' };
  }

  // Plain text output — keep as bash
  return { content: trimmed, lang: 'bash' };
}

// --- Session metadata rich rendering ---

interface ParsedSessionMeta {
  id: string;
  slug?: string;
  title: string;
  directory?: string;
  time: { created: number; updated: number };
  summary?: { additions: number; deletions: number; files: number };
  filePath?: string;
}

/**
 * Try to parse the === separator + JSON output as an array of session metadata objects.
 * Returns null if the output doesn't match the pattern.
 */
function parseSessionMetadataOutput(
  output: string,
): ParsedSessionMeta[] | null {
  const trimmed = output.trim();
  if (!trimmed.includes('===') || !trimmed.includes('"id"')) return null;

  // Split by === headers, extract JSON blocks
  const parts = trimmed.split(/^={2,}\s*(.*?)\s*={0,}\s*$/m);
  const sessions: ParsedSessionMeta[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim();
    if (!part) continue;

    // Try to parse as JSON session metadata
    try {
      const parsed = JSON.parse(part);
      if (parsed && typeof parsed === 'object' && parsed.id && parsed.time) {
        // Look backwards for the file path header
        const header = i > 0 ? parts[i - 1]?.trim() : undefined;
        sessions.push({
          id: parsed.id,
          slug: parsed.slug,
          title: parsed.title || parsed.slug || 'Untitled',
          directory: parsed.directory,
          time: parsed.time,
          summary: parsed.summary,
          filePath: header || undefined,
        });
      }
    } catch {
      /* not JSON */
    }
  }

  if (sessions.length === 0) return null;
  return sessions;
}

function formatSessionTime(timestamp: number): string {
  const d = new Date(timestamp);
  const now = Date.now();
  const diff = now - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function SessionMetadataList({ sessions }: { sessions: ParsedSessionMeta[] }) {
  return (
    <div className="flex flex-col gap-1 p-1.5">
      <div className="px-1.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() =>
            openTabAndNavigate({
              id: s.id,
              title: s.title || 'Session',
              type: 'session',
              href: `/sessions/${s.id}`,
              serverId: useServerStore.getState().activeServerId,
            })
          }
          className={cn(
            'flex items-start gap-2.5 px-2.5 py-2 rounded-md text-left w-full',
            'hover:bg-muted/60 transition-colors group cursor-pointer',
          )}
        >
          <MessageCircle className="size-3.5 flex-shrink-0 mt-0.5 text-muted-foreground group-hover:text-foreground/60 transition-colors" />
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground truncate">
                {s.title}
              </span>
              {s.summary && s.summary.files > 0 && (
                <span className="flex items-center gap-1 text-[10px] flex-shrink-0">
                  {s.summary.additions > 0 && (
                    <span className="text-emerald-500">
                      +{s.summary.additions}
                    </span>
                  )}
                  {s.summary.deletions > 0 && (
                    <span className="text-red-500">-{s.summary.deletions}</span>
                  )}
                  <span className="text-muted-foreground">
                    {s.summary.files} file{s.summary.files !== 1 ? 's' : ''}
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="font-mono truncate">{s.slug || s.id}</span>
              <span className="flex-shrink-0">
                {formatSessionTime(s.time.updated)}
              </span>
            </div>
          </div>
          <ExternalLink className="size-3 flex-shrink-0 mt-1 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
        </button>
      ))}
    </div>
  );
}

// --- Session messages rich rendering ---

interface ParsedSessionMessage {
  index: number;
  role: string;
  cost: number;
  content: string;
  tools?: string;
}

function parseSessionMessagesOutput(
  output: string,
): ParsedSessionMessage[] | null {
  const trimmed = output.trim();
  if (!trimmed.includes('--- Msg ')) return null;

  const msgRegex = /---\s*Msg\s+(\d+)\s+\[(\w+)\]\s+cost=\$?([\d.]+)\s*---/g;
  const matches = [...trimmed.matchAll(msgRegex)];
  if (matches.length < 1) return null;

  const messages: ParsedSessionMessage[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index! : trimmed.length;
    const rawContent = trimmed.slice(start, end).trim();

    const toolsMatch = rawContent.match(/^\s*Tools used:\s*(.+)$/m);
    const content = rawContent.replace(/^\s*Tools used:\s*.+$/m, '').trim();

    messages.push({
      index: parseInt(m[1], 10),
      role: m[2].toLowerCase(),
      cost: parseFloat(m[3]),
      content,
      tools: toolsMatch?.[1],
    });
  }

  return messages.length > 0 ? messages : null;
}

function InlineSessionMessagesList({
  messages,
}: {
  messages: ParsedSessionMessage[];
}) {
  return (
    <div className="flex flex-col gap-1 p-1.5">
      <div className="px-1.5 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {messages.length} message{messages.length !== 1 ? 's' : ''}
      </div>
      {messages.map((msg) => (
        <div
          key={msg.index}
          className={cn(
            'rounded-md border overflow-hidden',
            msg.role === 'user' ? 'border-border/60' : 'border-border/40',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-2 px-2.5 py-1',
              msg.role === 'user' ? 'bg-muted/50' : 'bg-card',
            )}
          >
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-wide',
                msg.role === 'user' ? 'text-blue-500' : 'text-emerald-500',
              )}
            >
              {msg.role}
            </span>
            <span className="text-[10px] text-muted-foreground/50 ml-auto">
              #{msg.index}
            </span>
            {msg.cost > 0 && (
              <span className="text-[10px] text-muted-foreground/50">
                ${(msg.cost * 1.2).toFixed(4)}
              </span>
            )}
          </div>
          <div className="px-2.5 py-1.5">
            <div className="text-[11px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
              {msg.content.slice(0, 800)}
              {msg.content.length > 800 && (
                <span className="text-muted-foreground/50">
                  {' '}
                  ... (truncated)
                </span>
              )}
            </div>
            {msg.tools && (
              <div className="mt-1 flex items-center gap-1 flex-wrap">
                {msg.tools.split(',').map((t, i) => {
                  const trimmedTool = t.trim();
                  const nameMatch = trimmedTool.match(/^(\w+)\s*\((\w+)\)/);
                  const name = nameMatch?.[1] || trimmedTool;
                  const toolStatus = nameMatch?.[2] || '';
                  return (
                    <span
                      key={i}
                      className={cn(
                        'text-[0.5625rem] px-1 py-0.5 rounded border',
                        toolStatus === 'completed'
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                          : 'bg-muted/50 border-border/50 text-muted-foreground',
                      )}
                    >
                      {name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function BashTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const streamingInput = partStreamingInput(part);
  const metadata = partMetadata(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const running = useContext(ToolRunningContext);
  const command =
    (input.command as string) ||
    (metadata.command as string) ||
    (streamingInput.command as string) ||
    '';
  const description =
    (input.description as string) ||
    (streamingInput.description as string) ||
    '';
  const strippedOutput = output ? stripAnsi(output) : '';

  // Try to detect session metadata output for rich rendering
  const sessionMeta = useMemo(
    () => parseSessionMetadataOutput(strippedOutput),
    [strippedOutput],
  );

  // Try to detect session messages output (--- Msg N [ROLE] cost=$X.XXXX ---)
  const sessionMessages = useMemo(
    () => (sessionMeta ? null : parseSessionMessagesOutput(strippedOutput)),
    [strippedOutput, sessionMeta],
  );

  // Try to detect structured log-like output (warnings, tracebacks, etc.)
  const structuredSections = useMemo(() => {
    if (sessionMeta || sessionMessages || !strippedOutput) return null;
    const normalized = normalizeToolOutput(strippedOutput);
    if (!hasStructuredContent(normalized)) return null;
    return parseStructuredOutput(normalized);
  }, [strippedOutput, sessionMeta, sessionMessages]);

  const outputBlock = useMemo(() => {
    if (!strippedOutput || sessionMeta || sessionMessages || structuredSections)
      return '';
    const { content, lang } = formatBashOutput(strippedOutput);
    return `\`\`\`${lang}\n${content}\n\`\`\``;
  }, [strippedOutput, sessionMeta, sessionMessages, structuredSections]);

  const hasOutput =
    !!sessionMeta || !!sessionMessages || !!structuredSections || !!outputBlock;

  const isStreaming = status === 'pending' && running;
  const isWaiting = !command && running;
  const isStalePending =
    !command && !running && (status === 'pending' || status === 'running');

  return (
    <BasicTool
      icon={<Terminal className="size-3.5 flex-shrink-0" />}
      trigger={
        isStalePending ? (
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="font-medium text-xs text-foreground whitespace-nowrap">
              Shell
            </span>
            <TextShimmer duration={1} spread={2} className="text-xs italic">
              Working...
            </TextShimmer>
          </div>
        ) : (
          {
            title: 'Shell',
            subtitle:
              description || (isWaiting ? 'Preparing command...' : undefined),
          }
        )
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      <div data-scrollable className="max-h-96 overflow-auto">
        {/* Command */}
        <div className="px-3 py-2.5 [&_code]:text-xs [&_code]:leading-relaxed [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:contents">
          {isWaiting ? (
            <div className="rounded-md border border-border/40 bg-background/50 px-2.5 py-2">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
                <Loader2 className="size-3 animate-spin" />
                <span>Preparing command...</span>
              </div>
            </div>
          ) : isStalePending ? (
            <div className="px-3 py-2 text-muted-foreground/60 text-[11px] italic">
              Preparing command...
            </div>
          ) : (
            <HighlightedCode code={`$ ${command}`} language="bash">
              {`$ ${command}`}
            </HighlightedCode>
          )}
        </div>
        {/* Output */}
        {hasOutput && (
          <div className="mx-2 mb-2 rounded-md border border-border/40 bg-background/50 overflow-hidden">
            {/* Output label */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-border/30">
              <div className="size-1.5 rounded-full bg-muted-foreground/25" />
              <span className="text-[0.5625rem] font-medium uppercase tracking-wider text-muted-foreground/60">
                Output
              </span>
            </div>
            {sessionMeta ? (
              <div className="p-2">
                <SessionMetadataList sessions={sessionMeta} />
              </div>
            ) : sessionMessages ? (
              <div className="p-2">
                <InlineSessionMessagesList messages={sessionMessages} />
              </div>
            ) : structuredSections ? (
              <div className="p-2">
                <StructuredOutput sections={structuredSections} />
              </div>
            ) : outputBlock ? (
              <div className={cn('p-2', MD_FLUSH_CLASSES)}>
                <UnifiedMarkdown
                  content={outputBlock}
                  isStreaming={status === 'running'}
                />
              </div>
            ) : null}
          </div>
        )}
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('bash', BashTool);
