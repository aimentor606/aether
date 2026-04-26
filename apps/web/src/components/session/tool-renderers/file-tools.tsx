'use client';

import React, { useContext, useMemo, useState } from 'react';
import { FileCode2, Glasses } from 'lucide-react';
import {
  HighlightedCode,
  UnifiedMarkdown,
} from '@/components/markdown/unified-markdown';
import { useOcFileOpen } from '@/hooks/use-oc-file-open';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn } from '@/lib/utils';
import { useFilePreviewStore } from '@/stores/file-preview-store';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  MD_FLUSH_CLASSES,
  partStreamingInput,
  partInput,
  partMetadata,
  partStatus,
  BasicTool,
  ToolRunningContext,
  InlineDiffView,
  getToolDiagnostics,
  DiagnosticsDisplay,
  DiffChanges,
} from './shared';
import { getDirectory, getFilename } from '@/ui';

function EditTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const streamingInput = partStreamingInput(part);
  const metadata = partMetadata(part);
  const filediff = metadata.filediff as Record<string, unknown> | undefined;
  const filePath =
    (input.filePath as string) ||
    (streamingInput.filePath as string) ||
    (streamingInput.target_filepath as string) ||
    undefined;
  const filename = getFilename(filePath) || '';
  const directory = filePath ? getDirectory(filePath) : undefined;
  const diagnostics = getToolDiagnostics(part, filePath);

  const additions = (filediff?.additions as number) ?? 0;
  const deletions = (filediff?.deletions as number) ?? 0;
  const before =
    (filediff?.before as string) ??
    (input.oldString as string) ??
    (streamingInput.oldString as string) ??
    '';
  const after =
    (filediff?.after as string) ??
    (input.newString as string) ??
    (streamingInput.newString as string) ??
    '';
  // For morph_edit, show streaming code_edit content
  const codeEdit =
    (input.code_edit as string) || (streamingInput.code_edit as string) || '';
  const morphInstructions =
    (input.instructions as string) ||
    (streamingInput.instructions as string) ||
    '';
  const hasDiff = before !== '' || after !== '';
  const isStreaming = partStatus(part) === 'pending';
  const running = useContext(ToolRunningContext);

  return (
    <BasicTool
      icon={<FileCode2 className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Edit
          </span>
          <span className="text-xs text-foreground font-mono truncate">
            {filename}
          </span>
          {directory && (
            <span className="text-muted-foreground text-[10px] font-mono truncate hidden sm:inline">
              {directory}
            </span>
          )}
          {filediff && (
            <DiffChanges additions={additions} deletions={deletions} />
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {hasDiff ? (
        <div data-scrollable className="max-h-96 overflow-auto">
          <InlineDiffView
            oldValue={before}
            newValue={after}
            filename={filename}
          />
        </div>
      ) : codeEdit ? (
        <div
          data-scrollable
          className={cn('max-h-96 overflow-auto', MD_FLUSH_CLASSES)}
        >
          <div className="p-2">
            {morphInstructions && (
              <div className="mb-2 text-[11px] text-muted-foreground italic">
                {morphInstructions}
              </div>
            )}
            <UnifiedMarkdown
              content={`\`\`\`${filename.split('.').pop() || ''}\n${codeEdit}\n\`\`\``}
              isStreaming={isStreaming && running}
            />
          </div>
        </div>
      ) : null}
      <DiagnosticsDisplay diagnostics={diagnostics} filePath={filePath} />
    </BasicTool>
  );
}
ToolRegistry.register('edit', EditTool);
ToolRegistry.register('morph_edit', EditTool);

// --- Write ---
function WriteTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const streamingInput = partStreamingInput(part);
  const metadata = partMetadata(part);
  const status = partStatus(part);
  const running = useContext(ToolRunningContext);
  const filePath =
    (input.filePath as string) ||
    (streamingInput.filePath as string) ||
    undefined;
  const filename = getFilename(filePath) || '';
  const directory = filePath ? getDirectory(filePath) : undefined;
  const content =
    (input.content as string) || (streamingInput.content as string) || '';
  const ext = filename.split('.').pop() || '';
  const diagnostics = getToolDiagnostics(part, filePath);

  // Detect stale pending: tool part is pending/running but no longer actively
  // loading (ToolRunningContext is false) and no filename was received.
  const isStalePending =
    !running && !filename && (status === 'pending' || status === 'running');
  const isStreaming = status === 'pending' && running;

  return (
    <BasicTool
      icon={<FileCode2 className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Write
          </span>
          {filename ? (
            <>
              <span className="text-xs text-foreground font-mono truncate">
                {filename}
              </span>
              {directory && (
                <span className="text-muted-foreground text-[10px] font-mono truncate hidden sm:inline">
                  {directory}
                </span>
              )}
            </>
          ) : isStalePending ? (
            <TextShimmer duration={1} spread={2} className="text-xs italic">
              Working...
            </TextShimmer>
          ) : null}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {content ? (
        <div
          data-scrollable
          className={cn('max-h-96 overflow-auto', MD_FLUSH_CLASSES)}
        >
          <div className="p-2">
            <UnifiedMarkdown
              content={`\`\`\`${ext}\n${content}\n\`\`\``}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      ) : isStalePending ? (
        <div className="px-3 py-2 text-muted-foreground/60 text-[11px] italic">
          Waiting for file content...
        </div>
      ) : null}
      <DiagnosticsDisplay diagnostics={diagnostics} filePath={filePath} />
    </BasicTool>
  );
}
ToolRegistry.register('write', WriteTool);

// --- Read ---
function ReadTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const streamingInput = partStreamingInput(part);
  const metadata = partMetadata(part);
  const status = partStatus(part);
  const filePath =
    (input.filePath as string) ||
    (streamingInput.filePath as string) ||
    undefined;
  const filename = getFilename(filePath) || '';
  const { openPreview } = useFilePreviewStore();
  const { toDisplayPath } = useOcFileOpen();

  const args: string[] = [];
  if (input.offset) args.push('offset=' + String(input.offset));
  if (input.limit) args.push('limit=' + String(input.limit));

  const loaded = useMemo(() => {
    if (status !== 'completed') return [];
    const val = metadata.loaded;
    if (!val || !Array.isArray(val)) return [];
    return val.filter((p): p is string => typeof p === 'string');
  }, [status, metadata.loaded]);

  return (
    <>
      <BasicTool
        icon={<Glasses className="size-3.5 flex-shrink-0" />}
        trigger={{ title: 'Read', subtitle: filename, args }}
        defaultOpen={defaultOpen}
        forceOpen={forceOpen}
        locked={locked}
        onSubtitleClick={filePath ? () => openPreview(filePath) : undefined}
      />
      {loaded.length > 0 && (
        <div className="mt-1 space-y-0.5 pl-2">
          {loaded.map((filepath, i) => (
            <div
              key={i}
              role="button"
              tabIndex={0}
              onClick={() => openPreview(filepath)}
              onKeyDown={(e) => e.key === 'Enter' && openPreview(filepath)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors group"
            >
              <span className="text-emerald-500">+</span>
              <span className="truncate font-mono text-[10px] group-hover:underline underline-offset-2">
                {toDisplayPath(filepath)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
ToolRegistry.register('read', ReadTool);
