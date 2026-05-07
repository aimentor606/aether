'use client';

import React, {
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Globe,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  partInput,
  partOutput,
  partStatus,
  ToolOutputFallback,
  BasicTool,
} from './shared';

function WebFetchTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const url = (input.url as string) || '';
  const args: string[] = [];
  if (input.format) args.push('format=' + String(input.format));

  return (
    <BasicTool
      icon={<Globe className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Web Fetch
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {url}
          </span>
          {args.map((arg, i) => (
            <span
              key={i}
              className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono whitespace-nowrap"
            >
              {arg}
            </span>
          ))}
          <ExternalLink className="size-3 text-muted-foreground/60 flex-shrink-0" />
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {output && <ToolOutputFallback output={output} toolName="web_fetch" />}
    </BasicTool>
  );
}
ToolRegistry.register('webfetch', WebFetchTool);

// --- WebSearch ---

/** A single source link from search results */
interface WebSearchSource {
  title: string;
  url: string;
  snippet?: string;
  author?: string;
  publishedDate?: string;
}

/** A query block (batch mode returns multiple) */
interface WebSearchQueryResult {
  query: string;
  answer?: string;
  sources: WebSearchSource[];
}

/**
 * Parse web search output — handles both:
 * 1. JSON batch format: { batch_mode, results: [{ query, answer, results: [{ title, url, snippet }] }] }
 * 2. Plain text format: Title: ...\nURL: ...\nText: ...
 */
function parseWebSearchOutput(output: string | any): WebSearchQueryResult[] {
  if (!output) return [];

  // Handle both string and already-parsed object (+ double-encoded)
  let parsed: any = null;
  if (typeof output === 'object' && output !== null) {
    parsed = output;
  } else if (typeof output === 'string') {
    try {
      let result = JSON.parse(output);
      // Handle double-encoded JSON string
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
        } catch {
          /* keep */
        }
      }
      parsed = typeof result === 'object' ? result : null;
    } catch {
      // Not JSON — try trimming whitespace/BOM
      const trimmed = output.trim().replace(/^\uFEFF/, '');
      if (trimmed !== output) {
        try {
          parsed = JSON.parse(trimmed);
        } catch {
          /* not JSON */
        }
      }
    }
  }

  if (parsed) {
    // Batch mode: { results: [{ query, answer, results: [...] }] }
    if (
      parsed.results &&
      Array.isArray(parsed.results) &&
      parsed.results.length > 0
    ) {
      const firstItem = parsed.results[0];
      if (firstItem && typeof firstItem.query === 'string') {
        // Batch query results
        const queryResults: WebSearchQueryResult[] = [];
        for (const r of parsed.results) {
          if (typeof r.query !== 'string') continue;
          const sources: WebSearchSource[] = [];
          if (Array.isArray(r.results)) {
            for (const s of r.results) {
              if (s.title && s.url) {
                sources.push({
                  title: s.title,
                  url: s.url,
                  snippet: s.snippet || s.content || s.text || undefined,
                  author: s.author || undefined,
                  publishedDate:
                    s.publishedDate || s.published_date || undefined,
                });
              }
            }
          }
          queryResults.push({
            query: r.query,
            answer: r.answer || undefined,
            sources,
          });
        }
        if (queryResults.length > 0) return queryResults;
      } else if (firstItem && (firstItem.title || firstItem.url)) {
        // Direct results array: { results: [{title, url, content}, ...] }
        const sources: WebSearchSource[] = [];
        for (const s of parsed.results) {
          if (s.title && s.url) {
            sources.push({
              title: s.title,
              url: s.url,
              snippet: s.snippet || s.content || s.text || undefined,
              author: s.author || undefined,
              publishedDate: s.publishedDate || s.published_date || undefined,
            });
          }
        }
        if (sources.length > 0) {
          return [
            {
              query: parsed.query || '',
              answer: parsed.answer || undefined,
              sources,
            },
          ];
        }
      }
    }

    // Single result: { query, answer, results: [...] }
    if (parsed.query && typeof parsed.query === 'string') {
      const sources: WebSearchSource[] = [];
      if (Array.isArray(parsed.results)) {
        for (const s of parsed.results) {
          if (s.title && s.url) {
            sources.push({
              title: s.title,
              url: s.url,
              snippet: s.snippet || s.content || s.text || undefined,
              author: s.author || undefined,
              publishedDate: s.publishedDate || s.published_date || undefined,
            });
          }
        }
      }
      return [
        { query: parsed.query, answer: parsed.answer || undefined, sources },
      ];
    }

    // Flat array: [{title, url, content}, ...]
    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed[0] &&
      (parsed[0].title || parsed[0].url)
    ) {
      const sources: WebSearchSource[] = [];
      for (const s of parsed) {
        if (s.title && s.url) {
          sources.push({
            title: s.title,
            url: s.url,
            snippet: s.snippet || s.content || s.text || undefined,
            author: s.author || undefined,
            publishedDate: s.publishedDate || s.published_date || undefined,
          });
        }
      }
      if (sources.length > 0) return [{ query: '', sources }];
    }
  }

  // --- Plain text format ---
  if (typeof output === 'string') {
    const blocks = output.split(/(?=^Title: )/m).filter(Boolean);
    const sources: WebSearchSource[] = [];
    for (const block of blocks) {
      const titleMatch = block.match(/^Title:\s*(.+)/m);
      const urlMatch = block.match(/^URL:\s*(.+)/m);
      const authorMatch = block.match(/^Author:\s*(.+)/m);
      const dateMatch = block.match(/^Published Date:\s*(.+)/m);
      const textMatch = block.match(/^Text:\s*([\s\S]*?)$/m);
      if (titleMatch && urlMatch) {
        sources.push({
          title: titleMatch[1].trim(),
          url: urlMatch[1].trim(),
          snippet: textMatch?.[1]?.trim() || undefined,
          author: authorMatch?.[1]?.trim() || undefined,
          publishedDate: dateMatch?.[1]?.trim() || undefined,
        });
      }
    }
    if (sources.length > 0) return [{ query: '', sources }];
  }
  return [];
}

function wsDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function wsFavicon(url: string): string | null {
  try {
    return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`;
  } catch {
    return null;
  }
}

function WebSearchTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const query = (input.query as string) || '';

  // Access raw state output to handle both string and object types
  const rawOutput =
    part.state.status === 'completed' ? (part.state as any).output : undefined;
  const queryResults = useMemo(
    () => parseWebSearchOutput(rawOutput ?? output),
    [rawOutput, output],
  );
  const totalSources = useMemo(
    () => queryResults.reduce((n, q) => n + q.sources.length, 0),
    [queryResults],
  );
  const [expandedQuery, setExpandedQuery] = useState<number | null>(null);

  // Compact trigger badge
  const triggerBadge =
    status === 'completed' && queryResults.length > 0
      ? queryResults.length > 1
        ? `${queryResults.length} queries`
        : totalSources > 0
          ? `${totalSources} ${totalSources === 1 ? 'source' : 'sources'}`
          : undefined
      : undefined;

  return (
    <BasicTool
      icon={<Search className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Web Search
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {query}
          </span>
          {triggerBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap ml-auto flex-shrink-0">
              {triggerBadge}
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {queryResults.length > 0 ? (
        <div data-scrollable className="max-h-[400px] overflow-auto">
          {queryResults.map((qr, qi) => {
            const isMulti = queryResults.length > 1;
            const isExpanded = expandedQuery === qi;

            return (
              <div
                key={qi}
                className={cn(qi > 0 && 'border-t border-border/30')}
              >
                {/* Query header (only in batch mode) */}
                {isMulti && (
                  <button
                    type="button"
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors cursor-pointer text-left"
                    onClick={() => setExpandedQuery(isExpanded ? null : qi)}
                  >
                    <Search className="size-3 text-muted-foreground/50 flex-shrink-0" />
                    <span className="text-[11px] font-medium text-foreground truncate flex-1">
                      {qr.query}
                    </span>
                    {qr.sources.length > 0 && (
                      <span className="text-[0.5625rem] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                        {qr.sources.length}
                      </span>
                    )}
                    <ChevronRight
                      className={cn(
                        'size-3 text-muted-foreground/60 flex-shrink-0 transition-transform',
                        (isExpanded || !isMulti) && 'rotate-90',
                      )}
                    />
                  </button>
                )}

                {/* Answer + Sources (always visible in single mode, toggled in batch) */}
                {(!isMulti || isExpanded) && (
                  <div className="px-3 pb-2.5">
                    {/* AI Answer */}
                    {qr.answer && (
                      <div className="mb-2.5 mt-1">
                        <p className="text-[11px] leading-relaxed text-foreground/80">
                          {qr.answer}
                        </p>
                      </div>
                    )}

                    {/* Sources */}
                    {qr.sources.length > 0 && (
                      <div className="space-y-1">
                        {qr.answer && (
                          <div className="text-[0.5625rem] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">
                            Sources
                          </div>
                        )}
                        {qr.sources.map((src, si) => {
                          const favicon = wsFavicon(src.url);
                          const domain = wsDomain(src.url);
                          return (
                            <a
                              key={si}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-start gap-2 p-2 -mx-1 rounded-lg hover:bg-muted/40 transition-colors"
                            >
                              {/* Favicon */}
                              <div className="size-5 rounded bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                                {favicon ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={favicon}
                                    alt=""
                                    className="size-4 rounded"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <Globe className="size-3 text-muted-foreground/50" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                  {src.title}
                                </div>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
                                    {domain}
                                  </span>
                                  {src.author && (
                                    <span className="text-[10px] text-muted-foreground/60 truncate">
                                      {src.author}
                                    </span>
                                  )}
                                </div>
                                {src.snippet && (
                                  <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-2 mt-1">
                                    {src.snippet.slice(0, 200)}
                                  </p>
                                )}
                              </div>
                              <ExternalLink className="size-3 text-muted-foreground/60 group-hover:text-muted-foreground/60 flex-shrink-0 mt-1 transition-colors" />
                            </a>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : output ? (
        <ToolOutputFallback
          output={output}
          isStreaming={status === 'running'}
          toolName="web_search"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('websearch', WebSearchTool);
ToolRegistry.register('web-search', WebSearchTool);
ToolRegistry.register('web_search', WebSearchTool);

// --- ScrapeWebpage ---

interface ScrapeResult {
  url: string;
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
}

interface ParsedScrapeOutput {
  total: number;
  successful: number;
  failed: number;
  results: ScrapeResult[];
}

function parseScrapeOutput(output: string | any): ParsedScrapeOutput | null {
  if (!output) return null;
  let parsed: any = null;
  if (typeof output === 'object' && output !== null) {
    parsed = output;
  } else if (typeof output === 'string') {
    try {
      let result = JSON.parse(output);
      if (typeof result === 'string') {
        try {
          result = JSON.parse(result);
        } catch {
          /* keep */
        }
      }
      parsed = typeof result === 'object' ? result : null;
    } catch {
      // Not JSON — return empty
    }
  }
  if (!parsed) return null;

  // Format: { total, successful, failed, results: [{url, success, title?, content?, error?}] }
  if (parsed.results && Array.isArray(parsed.results)) {
    return {
      total: parsed.total || parsed.results.length,
      successful:
        parsed.successful ??
        parsed.results.filter((r: any) => r.success !== false).length,
      failed:
        parsed.failed ??
        parsed.results.filter((r: any) => r.success === false).length,
      results: parsed.results.map((r: any) => ({
        url: r.url || '',
        success: r.success !== false,
        title: r.title || undefined,
        content: r.content || r.text || r.snippet || undefined,
        error: r.error || undefined,
      })),
    };
  }
  return null;
}

function ScrapeWebpageTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const urls = (input.urls as string) || '';
  const firstUrl = urls?.split(',')[0]?.trim() || '';
  const domain = firstUrl ? wsDomain(firstUrl) : '';

  const rawOutput =
    part.state.status === 'completed' ? (part.state as any).output : undefined;
  const scrapeData = useMemo(
    () => parseScrapeOutput(rawOutput ?? output),
    [rawOutput, output],
  );

  const triggerBadge = scrapeData
    ? `${scrapeData.successful}/${scrapeData.total} scraped`
    : undefined;

  return (
    <BasicTool
      icon={<Globe className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Scrape
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {domain || firstUrl}
          </span>
          {triggerBadge && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap ml-auto flex-shrink-0">
              {triggerBadge}
            </span>
          )}
          {!triggerBadge && (
            <ExternalLink className="size-3 text-muted-foreground/60 flex-shrink-0 ml-auto" />
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {scrapeData && scrapeData.results.length > 0 ? (
        <div
          data-scrollable
          className="max-h-[400px] overflow-y-auto overflow-x-hidden p-2"
        >
          <div className="space-y-0.5">
            {scrapeData.results.map((result, idx) => {
              const favicon = result.url ? wsFavicon(result.url) : null;
              const resultDomain = result.url ? wsDomain(result.url) : '';
              const snippet = result.content
                ? result.content
                    .replace(/\\n/g, ' ')
                    .replace(/\s+/g, ' ')
                    .slice(0, 200)
                : undefined;

              return (
                <a
                  key={idx}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  {/* Favicon */}
                  <div className="size-5 rounded bg-muted/60 flex items-center justify-center flex-shrink-0 mt-0.5 overflow-hidden">
                    {favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={favicon}
                        alt=""
                        className="size-4 rounded"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe className="size-3 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {result.title || resultDomain || result.url}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/50 font-mono truncate">
                        {resultDomain}
                      </span>
                    </div>
                    {result.success && snippet && (
                      <p className="text-[10px] text-muted-foreground/60 leading-relaxed line-clamp-2 mt-1 break-words">
                        {snippet}
                      </p>
                    )}
                    {!result.success && result.error && (
                      <p className="text-[10px] text-muted-foreground/70 leading-relaxed line-clamp-2 mt-1 break-words">
                        {result.error.slice(0, 150)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                    {result.success ? (
                      <CheckCircle className="size-3 text-emerald-500/70" />
                    ) : (
                      <AlertTriangle className="size-3 text-amber-500/70" />
                    )}
                    <ExternalLink className="size-3 text-muted-foreground/60 group-hover:text-muted-foreground/50 transition-colors" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ) : output ? (
        <ToolOutputFallback
          output={output.slice(0, 3000)}
          isStreaming={status === 'running'}
          toolName="scrape_webpage"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('scrape-webpage', ScrapeWebpageTool);
