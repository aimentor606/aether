'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  ChevronRight,
  FileText,
  ListTree,
  Search,
} from 'lucide-react';
import { useOcFileOpen } from '@/components/thread/tool-views/opencode/useOcFileOpen';
import { cn } from '@/lib/utils';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partStreamingInput,
  partInput,
  partOutput,
  partStatus,
  ToolEmptyState,
  ToolOutputFallback,
  BasicTool,
} from './shared';
import {
  getDirectory,
  getFilename,
} from '@/ui';

// ============================================================================
// Parsing helpers for Glob/Grep/List output
// ============================================================================

/** Try to parse output into a list of file paths (one per line) */
function parseFilePaths(output: string): string[] | null {
  if (!output) return null;
  const lines = output
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const pathLike = lines.filter(
    (l) => l.startsWith('/') || l.startsWith('./') || l.startsWith('~'),
  );
  if (pathLike.length >= lines.length * 0.7) return pathLike;
  return null;
}

interface GrepMatch {
  line: number;
  content: string;
}
interface GrepFileGroup {
  filePath: string;
  matches: GrepMatch[];
}

/** Parse grep output into structured file groups */
function parseGrepOutput(
  output: string,
): { matchCount: number; groups: GrepFileGroup[] } | null {
  if (!output) return null;
  const text = String(output).trim();
  const headerMatch = text.match(/^Found\s+(\d+)\s+match/i);
  const matchCount = headerMatch ? parseInt(headerMatch[1], 10) : 0;
  const body = headerMatch ? text.slice(headerMatch[0].length).trim() : text;
  if (!body) return null;

  const groups: GrepFileGroup[] = [];
  const blocks = body.split(/\n\n+/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const fileMatch = trimmed.match(/^(\/[^:]+?):\s*/);
    if (!fileMatch) continue;
    const filePath = fileMatch[1];
    const rest = trimmed.slice(fileMatch[0].length);
    const matches: GrepMatch[] = [];
    const lineRegex = /Line\s+(\d+):\s*([\s\S]*?)(?=\s*(?:Line\s+\d+:|$))/g;
    let m: RegExpExecArray | null;
    while ((m = lineRegex.exec(rest)) !== null) {
      matches.push({
        line: parseInt(m[1], 10),
        content: m[2].trim().replace(/;$/, ''),
      });
    }
    if (matches.length > 0) groups.push({ filePath, matches });
  }

  if (groups.length === 0) return null;
  return {
    matchCount:
      matchCount || groups.reduce((sum, g) => sum + g.matches.length, 0),
    groups,
  };
}

// ============================================================================
// InlineFileList — styled file path list for Glob/List
// ============================================================================

function InlineFileList({
  paths,
  onFileClick,
  toDisplayPath,
}: {
  paths: string[];
  onFileClick: (path: string) => void;
  toDisplayPath: (p: string) => string;
}) {
  return (
    <div className="py-0.5">
      {paths.map((fp, i) => {
        const dp = toDisplayPath(fp);
        const name = getFilename(dp);
        const dir = getDirectory(dp);
        return (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1 cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={() => onFileClick(fp)}
            title={dp}
          >
            <FileText className="size-3 text-muted-foreground/50 flex-shrink-0 group-hover:text-foreground/60 transition-colors" />
            <span className="text-[11px] min-w-0 flex items-baseline gap-1.5 overflow-hidden">
              <span className="text-foreground font-medium font-mono whitespace-nowrap flex-shrink-0">
                {name}
              </span>
              {dir && (
                <span className="text-muted-foreground/40 truncate text-[10px]">
                  {dir}
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// InlineGrepResults — styled grep result groups
// ============================================================================

function InlineGrepResults({
  groups,
  onFileClick,
  toDisplayPath,
}: {
  groups: GrepFileGroup[];
  onFileClick: (path: string) => void;
  toDisplayPath: (p: string) => string;
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    groups.length === 1 ? 0 : null,
  );

  return (
    <div className="py-0.5">
      {groups.map((group, i) => {
        const dp = toDisplayPath(group.filePath);
        const name = getFilename(dp);
        const dir = getDirectory(dp);
        const isExpanded = expandedIndex === i;

        return (
          <div key={i}>
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors group"
              onClick={() => setExpandedIndex(isExpanded ? null : i)}
            >
              <ChevronRight
                className={cn(
                  'size-3 text-muted-foreground flex-shrink-0 transition-transform',
                  isExpanded && 'rotate-90',
                )}
              />
              <FileText className="size-3 text-muted-foreground/50 flex-shrink-0" />
              <span className="text-[11px] min-w-0 flex items-baseline gap-1.5 overflow-hidden flex-1">
                <span
                  className="text-foreground font-medium font-mono whitespace-nowrap flex-shrink-0 cursor-pointer hover:text-blue-500 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileClick(group.filePath);
                  }}
                  title={group.filePath}
                >
                  {name}
                </span>
                {dir && (
                  <span className="text-muted-foreground/40 truncate text-[10px]">
                    {dir}
                  </span>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                {group.matches.length}
              </span>
            </div>
            {isExpanded && (
              <div className="border-t border-border/20 bg-muted/10">
                {group.matches.map((match, j) => (
                  <div
                    key={j}
                    className="flex items-start gap-0 border-b last:border-b-0 border-border/10"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground/50 w-10 text-right pr-2 py-1 flex-shrink-0 select-none">
                      {match.line}
                    </span>
                    <span className="text-[10px] font-mono text-foreground/70 py-1 pr-2 break-all leading-relaxed">
                      {match.content}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// --- Glob ---
function GlobTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const streamingInput = partStreamingInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const { openFile, openFileWithList, toDisplayPath } = useOcFileOpen();
  const directory =
    getDirectory((input.path as string) || (streamingInput.path as string)) ||
    undefined;
  const args: string[] = [];
  const pattern = (input.pattern || streamingInput.pattern) as
    | string
    | undefined;
  if (pattern) args.push('pattern=' + String(pattern));

  const filePaths = useMemo(() => parseFilePaths(output), [output]);
  const hasResults = filePaths && filePaths.length > 0;
  const isNoResults = !hasResults && status === 'completed' && !!output;

  return (
    <BasicTool
      icon={<Search className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Glob',
        subtitle: directory,
        args: [
          ...args,
          ...(isNoResults ? [] : []),
          ...(hasResults
            ? [
                `${filePaths.length} ${filePaths.length === 1 ? 'file' : 'files'}`,
              ]
            : isNoResults
              ? ['no matches']
              : []),
        ],
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {hasResults ? (
        <div data-scrollable className="max-h-72 overflow-auto">
          <InlineFileList
            paths={filePaths}
            onFileClick={(fp) => openFileWithList(fp, filePaths)}
            toDisplayPath={toDisplayPath}
          />
        </div>
      ) : isNoResults ? (
        <ToolEmptyState message="No matching files found" />
      ) : output ? (
        <ToolOutputFallback output={output} toolName="glob" />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('glob', GlobTool);

// --- Grep ---
function GrepTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const streamingInput = partStreamingInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const { openFile, toDisplayPath } = useOcFileOpen();
  const directory =
    getDirectory((input.path as string) || (streamingInput.path as string)) ||
    undefined;
  const args: string[] = [];
  const grepPattern = (input.pattern || streamingInput.pattern) as
    | string
    | undefined;
  const grepInclude = (input.include || streamingInput.include) as
    | string
    | undefined;
  if (grepPattern) args.push('pattern=' + String(grepPattern));
  if (grepInclude) args.push('include=' + String(grepInclude));

  const grepResult = useMemo(() => parseGrepOutput(output), [output]);
  const hasResults = !!grepResult;
  const isNoResults = !hasResults && status === 'completed' && !!output;

  return (
    <BasicTool
      icon={<Search className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Grep',
        subtitle: directory,
        args: [
          ...args,
          ...(hasResults
            ? [
                `${grepResult.groups.length} ${grepResult.groups.length === 1 ? 'file' : 'files'}`,
              ]
            : isNoResults
              ? ['no matches']
              : []),
        ],
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {hasResults ? (
        <div data-scrollable className="max-h-72 overflow-auto">
          <InlineGrepResults
            groups={grepResult.groups}
            onFileClick={(fp) => openFile(fp)}
            toDisplayPath={toDisplayPath}
          />
        </div>
      ) : isNoResults ? (
        <ToolEmptyState message="No matching results found" />
      ) : output ? (
        <ToolOutputFallback output={output} toolName="grep" />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('grep', GrepTool);

// --- List ---
function ListTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const { openFile, openFileWithList, toDisplayPath } = useOcFileOpen();
  const directory =
    getDirectory(input.path as string) || (input.path as string) || undefined;

  const filePaths = useMemo(() => parseFilePaths(output), [output]);
  const hasResults = filePaths && filePaths.length > 0;
  const isNoResults = !hasResults && status === 'completed' && !!output;

  return (
    <BasicTool
      icon={<ListTree className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'List',
        subtitle: directory,
        args: hasResults
          ? [`${filePaths.length} ${filePaths.length === 1 ? 'file' : 'files'}`]
          : isNoResults
            ? ['empty']
            : undefined,
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {hasResults ? (
        <div data-scrollable className="max-h-72 overflow-auto">
          <InlineFileList
            paths={filePaths}
            onFileClick={(fp) => openFileWithList(fp, filePaths)}
            toDisplayPath={toDisplayPath}
          />
        </div>
      ) : isNoResults ? (
        <ToolEmptyState message="Directory is empty" />
      ) : output ? (
        <ToolOutputFallback output={output} toolName="list" />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('list', ListTool);
