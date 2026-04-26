'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  Brain,
  FileText,
  Fingerprint,
  Hash,
  CalendarClock,
  ListTree,
  Search,
  Tags,
} from 'lucide-react';
import { parseMemorySearchOutput } from '@/lib/utils/memory-search-output';
import { parseMemoryEntryOutput } from '@/lib/utils/memory-entry-output';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partOutput,
  partStatus,
  ToolEmptyState,
  ToolOutputFallback,
  BasicTool,
  ToolRunningContext,
} from './shared';


function GetMemTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const running = useContext(ToolRunningContext);
  const source = (input.source as string) || '';
  const memoryId = input.id != null ? String(input.id) : '';
  const report = useMemo(() => parseMemoryEntryOutput(output), [output]);
  const isStreaming = (status === 'pending' && running) || status === 'running';

  return (
    <BasicTool
      icon={<Brain className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: 'Get Mem',
        subtitle: memoryId ? `#${memoryId}` : undefined,
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      <div className="p-2.5 space-y-2.5">
        {(source || memoryId) && (
          <div className="rounded-xl border border-sky-200/50 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/60 via-background to-background dark:from-sky-950/20 p-2.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-700/80 dark:text-sky-300/80 mb-1.5">
              Request
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {source && (
                <span className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium border border-sky-200/70 dark:border-sky-800/50 bg-sky-100/70 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                  Source: {source}
                </span>
              )}
              {memoryId && (
                <span className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-semibold border border-sky-200/80 dark:border-sky-800/60 bg-background text-foreground/85 font-mono">
                  <Hash className="size-3.5" />
                  {memoryId}
                </span>
              )}
            </div>
          </div>
        )}

        {report ? (
          report.kind === 'observation' ? (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-background via-background to-amber-50/20 dark:to-amber-950/10 overflow-hidden shadow-sm">
              <div className="px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-amber-50/70 to-background dark:from-amber-950/20">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] border border-amber-200/80 dark:border-amber-800/60 bg-background/90">
                    <Fingerprint className="size-3" />
                    Observation #{report.id}
                  </span>
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-amber-200/80 dark:border-amber-800/60 bg-amber-100/70 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 uppercase tracking-wide">
                    {report.type}
                  </span>
                  {report.created && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-background/70 border border-border/60 rounded-full px-2 py-1">
                      <CalendarClock className="size-3" />
                      {report.created}
                    </span>
                  )}
                </div>
                <h3 className="mt-2 text-[15px] leading-snug font-semibold text-foreground">
                  {report.title}
                </h3>
              </div>
              <div className="p-3 space-y-2.5">
                {report.narrative && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-b from-background to-muted/10 p-2.5">
                    <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                      <FileText className="size-3" />
                      Narrative
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/85">
                      {report.narrative}
                    </p>
                  </div>
                )}
                {report.facts.length > 0 && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-b from-background to-muted/10 p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        <ListTree className="size-3" />
                        Facts
                      </div>
                      <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-muted/60 border border-border/60">
                        {report.facts.length}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {report.facts.map((fact, index) => (
                        <li
                          key={`${report.id}-${index}`}
                          className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground/90"
                        >
                          <span className="mt-[6px] size-1.5 rounded-full bg-emerald-500/90 flex-shrink-0" />
                          <span>{fact}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.concepts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-gradient-to-r from-background to-muted/20 p-2.5">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mr-0.5">
                      <Tags className="size-3" />
                      Concepts
                    </span>
                    {report.concepts.map((concept) => (
                      <span
                        key={concept}
                        className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-emerald-100/60 text-emerald-800 border border-emerald-200/70 dark:bg-emerald-900/25 dark:text-emerald-100 dark:border-emerald-800/60"
                      >
                        {concept}
                      </span>
                    ))}
                  </div>
                )}
                {(report.tool ||
                  report.prompt ||
                  report.session ||
                  report.filesRead.length > 0) && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/10 to-background p-2.5 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {report.tool && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-border/60 bg-background/80 font-medium">
                          Tool: {report.tool}
                        </span>
                      )}
                      {report.prompt && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-border/60 bg-background/80 font-medium">
                          Prompt #{report.prompt}
                        </span>
                      )}
                      {report.session && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-border/60 bg-background/80 font-mono font-medium">
                          {report.session}
                        </span>
                      )}
                    </div>
                    {report.filesRead.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                          Files read
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {report.filesRead.map((file) => (
                            <span
                              key={file}
                              className="inline-flex items-center h-6 px-2 rounded-md text-[10px] font-mono bg-background border border-border/70 text-foreground/75 break-all"
                            >
                              {file}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/60 bg-gradient-to-b from-background via-background to-amber-50/20 dark:to-amber-950/10 overflow-hidden shadow-sm">
              <div className="px-3 py-2.5 border-b border-border/50 bg-gradient-to-r from-amber-50/70 to-background dark:from-amber-950/20">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full text-[10px] border border-amber-200/80 dark:border-amber-800/60 bg-background/90">
                    <Fingerprint className="size-3" />
                    LTM #{report.id}
                  </span>
                  <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-amber-200/80 dark:border-amber-800/60 bg-amber-100/70 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100 uppercase tracking-wide">
                    {report.type}
                  </span>
                  {report.created && (
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-background/70 border border-border/60 rounded-full px-2 py-1">
                      <CalendarClock className="size-3" />
                      {report.created}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-3 space-y-2.5">
                {report.caption && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-b from-background to-muted/10 p-2.5">
                    <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                      <FileText className="size-3" />
                      Caption
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/85">
                      {report.caption}
                    </p>
                  </div>
                )}
                {report.content && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-b from-background to-muted/10 p-2.5">
                    <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1.5">
                      <ListTree className="size-3" />
                      Content
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {report.content}
                    </p>
                  </div>
                )}
                {report.tags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/50 bg-gradient-to-r from-background to-muted/20 p-2.5">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground mr-0.5">
                      <Tags className="size-3" />
                      Tags
                    </span>
                    {report.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-medium bg-emerald-100/60 text-emerald-800 border border-emerald-200/70 dark:bg-emerald-900/25 dark:text-emerald-100 dark:border-emerald-800/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {(report.session || report.updated) && (
                  <div className="rounded-xl border border-border/50 bg-gradient-to-b from-muted/10 to-background p-2.5 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {report.session && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-border/60 bg-background/80 font-mono font-medium">
                          {report.session}
                        </span>
                      )}
                      {report.updated && (
                        <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-border/60 bg-background/80 font-medium">
                          Updated: {report.updated}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        ) : output ? (
          <ToolOutputFallback
            output={output}
            isStreaming={isStreaming}
            toolName="get_mem"
          />
        ) : (
          <ToolEmptyState
            message={isStreaming ? 'Loading memory...' : 'No memory found.'}
          />
        )}
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('get_mem', GetMemTool);
ToolRegistry.register('get-mem', GetMemTool);
ToolRegistry.register('oc-get_mem', GetMemTool);
ToolRegistry.register('oc-get-mem', GetMemTool);

function MemorySearchTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const running = useContext(ToolRunningContext);
  const parsed = useMemo(() => parseMemorySearchOutput(output), [output]);
  const query = ((input.query as string) || parsed.query || '').trim();
  const source = ((input.source as string) || '').trim();
  const isStreaming = (status === 'pending' && running) || status === 'running';
  const triggerTitle = parsed.label.toLowerCase().includes('ltm')
    ? 'LTM Search'
    : 'Memory Search';
  const resultCount = parsed.hits.length;

  return (
    <BasicTool
      icon={<Search className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: triggerTitle,
        subtitle: query || undefined,
        args:
          status === 'completed'
            ? [`${resultCount} ${resultCount === 1 ? 'result' : 'results'}`]
            : undefined,
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      <div className="p-2.5 space-y-2.5">
        {(query || source) && (
          <div className="rounded-xl border border-sky-200/50 dark:border-sky-900/50 bg-gradient-to-r from-sky-50/60 via-background to-background dark:from-sky-950/20 p-2.5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-sky-700/80 dark:text-sky-300/80 mb-1.5">
              Request
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {source && (
                <span className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium border border-sky-200/70 dark:border-sky-800/50 bg-sky-100/70 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200">
                  Source: {source}
                </span>
              )}
              {query && (
                <span className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-mono border border-border/60 bg-background text-foreground/85">
                  {query}
                </span>
              )}
            </div>
          </div>
        )}

        {parsed.hits.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-gradient-to-b from-background to-muted/10 p-2.5 space-y-2">
            {parsed.hits.map((hit) => {
              const sourceLabel =
                hit.source === 'ltm'
                  ? 'LTM'
                  : hit.source === 'obs'
                    ? 'Observation'
                    : 'Memory';
              return (
                <div
                  key={`${hit.source}-${hit.id}-${hit.type}`}
                  className="rounded-lg border border-border/60 bg-background/80 px-2.5 py-2"
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="inline-flex items-center h-5 px-1.5 rounded-full text-[10px] border border-border/60 bg-muted/30">
                      {sourceLabel} / {hit.type}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60 font-mono">
                      #{hit.id}
                    </span>
                    {hit.confidence != null && (
                      <span className="ml-auto text-[10px] text-muted-foreground/60">
                        {Math.round(hit.confidence * 100)}% conf
                      </span>
                    )}
                  </div>
                  <p className="text-xs leading-relaxed text-foreground/90">
                    {hit.content}
                  </p>
                  {hit.files.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {hit.files.map((file) => (
                        <span
                          key={file}
                          className="inline-flex items-center h-5 px-1.5 rounded text-[10px] font-mono bg-muted/50 text-muted-foreground"
                        >
                          {file}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : parsed.matched ? (
          <ToolEmptyState
            message={isStreaming ? 'Searching memory...' : 'No memories found.'}
          />
        ) : output ? (
          <ToolOutputFallback
            output={output}
            isStreaming={isStreaming}
            toolName="ltm_search"
          />
        ) : (
          <ToolEmptyState
            message={
              isStreaming ? 'Searching memory...' : 'No search output yet.'
            }
          />
        )}
      </div>
    </BasicTool>
  );
}
ToolRegistry.register('ltm_search', MemorySearchTool);
ToolRegistry.register('ltm-search', MemorySearchTool);
ToolRegistry.register('mem_search', MemorySearchTool);
ToolRegistry.register('mem-search', MemorySearchTool);
ToolRegistry.register('memory_search', MemorySearchTool);
ToolRegistry.register('memory-search', MemorySearchTool);
ToolRegistry.register('oc-mem_search', MemorySearchTool);
ToolRegistry.register('oc-mem-search', MemorySearchTool);
