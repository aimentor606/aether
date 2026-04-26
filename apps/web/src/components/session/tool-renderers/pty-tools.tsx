'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Terminal,
} from 'lucide-react';
import { HighlightedCode, UnifiedMarkdown } from '@/components/markdown/unified-markdown';
import { cn } from '@/lib/utils';
import { PreWithPaths } from '@/components/common/clickable-path';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partOutput,
  partStatus,
  BasicTool,
} from './shared';
import {
  stripAnsi,
} from '@/ui';


// --- Pty Spawn ---
function PtySpawnTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);

  const parsed = useMemo(() => {
    const match = output.match(/<pty_spawned>([\s\S]*?)<\/pty_spawned>/);
    if (!match) return null;
    const fields: Record<string, string> = {};
    for (const line of match[1].trim().split('\n')) {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        fields[line.slice(0, colonIdx).trim()] = line
          .slice(colonIdx + 1)
          .trim();
      }
    }
    return fields;
  }, [output]);

  const title = parsed?.Title || (input.title as string) || '';
  const command = parsed?.Command || (input.command as string) || '';
  const processStatus = parsed?.Status || '';
  const pid = parsed?.PID || '';
  const ptyId = parsed?.ID || '';
  const workdir = parsed?.Workdir || '';

  return (
    <BasicTool
      icon={<Terminal className="size-3.5 flex-shrink-0" />}
      trigger={{ title: 'Spawn', subtitle: title || command }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      <div className="space-y-0">
        {command && (
          <div className="px-3 py-2.5 [&_code]:text-xs [&_code]:leading-relaxed [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:contents">
            <HighlightedCode code={`$ ${command}`} language="bash">
              {`$ ${command}`}
            </HighlightedCode>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-t border-border/20">
          {processStatus && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium',
                processStatus === 'running'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : processStatus === 'exited' || processStatus === 'stopped'
                    ? 'bg-muted/60 text-muted-foreground'
                    : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {processStatus === 'running' && (
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {processStatus}
            </span>
          )}
          {ptyId && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
              {ptyId}
            </span>
          )}
          {pid && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono">
              PID {pid}
            </span>
          )}
          {workdir && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono truncate max-w-[200px]"
              title={workdir}
            >
              {workdir}
            </span>
          )}
        </div>
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('pty_spawn', PtySpawnTool);

// --- Pty Read ---
function PtyReadTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);

  const parsed = useMemo(() => {
    const match = output.match(
      /<pty_output\s+([^>]*)>([\s\S]*?)<\/pty_output>/,
    );
    if (!match)
      return {
        id: '',
        ptyStatus: '',
        content: stripAnsi(output),
        bufferInfo: '',
      };

    const attrs = match[1];
    const rawContent = match[2];

    const idMatch = attrs.match(/id="([^"]+)"/);
    const statusMatch = attrs.match(/status="([^"]+)"/);

    const lines = rawContent.trim().split('\n');
    const contentLines: string[] = [];
    let bufferInfo = '';

    for (const line of lines) {
      if (/^\(End of buffer/.test(line.trim())) {
        bufferInfo = line.trim();
        continue;
      }
      contentLines.push(line.replace(/^\d{5}\|\s?/, ''));
    }

    return {
      id: idMatch?.[1] || '',
      ptyStatus: statusMatch?.[1] || '',
      content: stripAnsi(contentLines.join('\n').trim()),
      bufferInfo,
    };
  }, [output]);

  const ptyId = parsed.id || (input.id as string) || '';

  return (
    <BasicTool
      icon={<Terminal className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Terminal Output
          </span>
          {ptyId && (
            <span className="text-muted-foreground text-[10px] truncate font-mono">
              {ptyId}
            </span>
          )}
          {parsed.ptyStatus && (
            <span
              className={cn(
                'inline-flex items-center gap-1 ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0',
                parsed.ptyStatus === 'running'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {parsed.ptyStatus === 'running' && (
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {parsed.ptyStatus}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {parsed.content && (
        <div data-scrollable className="max-h-96 overflow-auto">
          <PreWithPaths
            text={parsed.content}
            className="p-2.5 font-mono text-[11px] leading-relaxed text-foreground/80 whitespace-pre-wrap"
          />
          {parsed.bufferInfo && (
            <div className="px-2.5 pb-2 text-[10px] text-muted-foreground/50 italic">
              {parsed.bufferInfo}
            </div>
          )}
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('pty_read', PtyReadTool);

// --- Pty Write ---
function PtyWriteTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const ptyInput = (input.input as string) || (input.text as string) || '';
  const ptyId = (input.id as string) || (input.pty_id as string) || '';

  return (
    <BasicTool
      icon={<Terminal className="size-3.5 flex-shrink-0" />}
      trigger={{ title: 'Terminal Input', subtitle: ptyId }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {ptyInput && (
        <div className="px-3 py-2.5">
          <pre className="font-mono text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap break-all">
            <span className="text-muted-foreground/60 select-none">&gt; </span>
            {ptyInput}
          </pre>
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('pty_write', PtyWriteTool);
ToolRegistry.register('pty_input', PtyWriteTool);

// --- Pty Kill ---
function PtyKillTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const ptyId = (input.id as string) || (input.pty_id as string) || '';

  const cleanOutput = useMemo(() => {
    if (!output) return '';
    return (
      output
        .replace(/<\/?[\w_]+(?:\s[^>]*)?>[\s\S]*?(?:<\/[\w_]+>)?/g, '')
        .trim() || output.replace(/<\/?[\w_]+[^>]*>/g, '').trim()
    );
  }, [output]);

  return (
    <BasicTool
      icon={<Terminal className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Kill Process',
        subtitle: ptyId,
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {cleanOutput && (
        <div className="p-2.5 text-[11px] text-muted-foreground">
          {cleanOutput}
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('pty_kill', PtyKillTool);
