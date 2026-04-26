'use client';

import React, {
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  AlertTriangle,
  Check,
  CircleAlert,
  Code2,
  Cpu,
  ExternalLink,
  FileIcon,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MonitorPlay,
  Music,
  Presentation,
  Search,
  Type,
  Video,
} from 'lucide-react';
import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn } from '@/lib/utils';
import { useSandboxProxy } from '@/hooks/use-sandbox-proxy';
import { useFileContent } from '@/features/files/hooks/use-file-content';
import { isAppRouteUrl, isProxiableLocalhostUrl, parseLocalhostUrl } from '@/lib/utils/sandbox-url';
import { openTabAndNavigate } from '@/stores/tab-store';
import { enrichPreviewMetadata } from '@/lib/utils/session-context';
import { ToolRegistry } from './registry';
import {
  type ToolProps,
  useProxyUrl,
  IMAGE_EXT_RE,
  normalizeWorkspacePath,
  isLocalSandboxFilePath,
  ensureWorkspacePath,
  InlineServicePreview,
  partInput,
  partOutput,
  partStatus,
  ToolOutputFallback,
  BasicTool,
  ToolRunningContext,
} from './shared';


// --- ImageSearch ---
function ImageSearchTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const query = (input.query as string) || '';

  // Parse image results - handles single and batch formats
  const { imageResults, isBatch, batchCount, displayQuery } = useMemo(() => {
    if (!output)
      return {
        imageResults: [],
        isBatch: false,
        batchCount: 0,
        displayQuery: query,
      };
    try {
      const parsed = JSON.parse(output);

      // Handle batch mode: { batch_mode: true, results: [{ query, total, images }] }
      if (parsed.batch_mode === true && Array.isArray(parsed.results)) {
        const allImages = parsed.results.flatMap((r: any) =>
          Array.isArray(r.images) ? r.images : [],
        );
        const queries = parsed.results.map((r: any) => r.query).filter(Boolean);
        return {
          imageResults: allImages,
          isBatch: true,
          batchCount: parsed.results.length,
          displayQuery:
            queries.length > 1
              ? `${queries.length} queries`
              : queries[0] || query,
        };
      }

      // Handle legacy batch_results
      if (parsed.batch_results && Array.isArray(parsed.batch_results)) {
        const allImages = parsed.batch_results.flatMap((r: any) =>
          Array.isArray(r.images) ? r.images : [],
        );
        return {
          imageResults: allImages,
          isBatch: true,
          batchCount: parsed.batch_results.length,
          displayQuery: query,
        };
      }

      // Single result formats
      if (Array.isArray(parsed))
        return {
          imageResults: parsed,
          isBatch: false,
          batchCount: 0,
          displayQuery: query,
        };
      if (parsed.images && Array.isArray(parsed.images))
        return {
          imageResults: parsed.images,
          isBatch: false,
          batchCount: 0,
          displayQuery: query,
        };
      if (parsed.results && Array.isArray(parsed.results))
        return {
          imageResults: parsed.results,
          isBatch: false,
          batchCount: 0,
          displayQuery: query,
        };
    } catch {
      // Not JSON — return empty
    }
    return {
      imageResults: [],
      isBatch: false,
      batchCount: 0,
      displayQuery: query,
    };
  }, [output, query]);

  return (
    <BasicTool
      icon={<ImageIcon className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="font-medium text-xs text-foreground whitespace-nowrap">
            Image Search
          </span>
          <span className="text-muted-foreground text-xs truncate font-mono">
            {displayQuery}
          </span>
          {imageResults.length > 0 && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-muted/60 text-muted-foreground font-mono whitespace-nowrap ml-auto flex-shrink-0">
              {isBatch ? `${batchCount}q, ` : ''}
              {imageResults.length} images
            </span>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {imageResults.length > 0 ? (
        <div
          data-scrollable
          className="p-2 max-h-80 overflow-auto scrollbar-hide"
        >
          <div className="grid grid-cols-3 gap-1.5">
            {imageResults.slice(0, 9).map((img: any, i: number) => {
              const imgUrl = img.url || img.imageUrl || img.image_url || '';
              if (!imgUrl) return null;
              const title = img.title || '';
              return (
                <a
                  key={i}
                  href={imgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative group overflow-hidden rounded border border-border/30 bg-muted/20 aspect-square"
                  title={title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imgUrl}
                    alt={title}
                    className="object-cover w-full h-full group-hover:opacity-80 transition-opacity"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/50 to-transparent flex items-end p-1">
                    <span className="text-[0.5625rem] text-white truncate">
                      {title}
                    </span>
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
          toolName="image_search"
        />
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('image-search', ImageSearchTool);

// --- ImageGen ---
function ImageGenTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const prompt = input.prompt as string | undefined;
  const action = input.action as string | undefined;

  // Extract image info from output
  const { imagePath, directUrl } = useMemo(() => {
    if (!output) return { imagePath: null, directUrl: null };
    const trimmed = output.trim();

    // 1. Try JSON parse
    try {
      const parsed = JSON.parse(trimmed);
      const p = parsed.path || parsed.image_path || parsed.output_path || null;
      const url =
        parsed.replicate_url || parsed.url || parsed.image_url || null;
      return {
        imagePath: p ? String(p).trim() : null,
        directUrl: url ? String(url).trim() : null,
      };
    } catch {
      // not JSON
    }

    // 2. Check if output itself is a file path
    const cleaned = trimmed.replace(/^["']+|["']+$/g, '').trim();
    if (IMAGE_EXT_RE.test(cleaned)) {
      const normalized =
        cleaned.startsWith('/workspace/') || cleaned.startsWith('workspace/')
          ? normalizeWorkspacePath(cleaned)
          : cleaned;
      return { imagePath: normalized, directUrl: null };
    }

    // 3. Extract path from surrounding text
    const extractedPath = trimmed.match(
      /\/workspace\/[^\s"']+\.(?:png|jpe?g|gif|webp|svg|bmp|ico)/i,
    );
    if (extractedPath?.[0]) {
      return { imagePath: extractedPath[0], directUrl: null };
    }

    return { imagePath: null, directUrl: null };
  }, [output]);

  // If we have a direct HTTPS URL (e.g. replicate_url), use it directly — no need to fetch via sandbox
  // If we have a local sandbox path, use useFileContent to get base64 (same as ImagePreview.tsx)
  // Strip /workspace/ prefix since the SDK expects paths relative to project root
  const isLocalPath = imagePath ? isLocalSandboxFilePath(imagePath) : false;
  const fileContentPath = useMemo(() => {
    if (!isLocalPath || !imagePath || directUrl) return null;
    return imagePath.replace(/^\/workspace\//, '');
  }, [isLocalPath, imagePath, directUrl]);
  const { data: fileContentData, isLoading: isImageLoading } = useFileContent(
    fileContentPath,
    { enabled: !!fileContentPath },
  );

  // Convert base64 to blob URL (same as ImagePreview.tsx)
  const imageUrl = useMemo(() => {
    if (fileContentData?.encoding === 'base64' && fileContentData?.content) {
      const binary = atob(fileContentData.content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: fileContentData.mimeType || 'image/webp',
      });
      return URL.createObjectURL(blob);
    }
    return null;
  }, [fileContentData]);

  // Priority: direct URL > blob from sandbox > local path fallback
  const displayImageSrc = directUrl || imageUrl || '';

  const titleMap: Record<string, string> = {
    generate: 'Generate Image',
    edit: 'Edit Image',
    upscale: 'Upscale Image',
    remove_bg: 'Remove Background',
  };

  return (
    <BasicTool
      icon={<ImageIcon className="size-3.5 flex-shrink-0" />}
      trigger={{
        title: titleMap[action ?? ''] || 'Image Gen',
        subtitle: prompt?.slice(0, 60),
      }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {imagePath || directUrl ? (
        <div className="p-2">
          {displayImageSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={displayImageSrc}
              alt={String(prompt || 'Generated image')}
              className="rounded border border-border/30 max-h-64 object-contain"
            />
          ) : isImageLoading ? (
            <div className="rounded border border-border/30 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground">
              Loading image preview...
            </div>
          ) : (
            <div className="rounded border border-border/30 bg-muted/20 px-2.5 py-2 text-[11px] text-muted-foreground font-mono break-all">
              {imagePath}
            </div>
          )}
        </div>
      ) : output ? (
        <div data-scrollable className="p-2 max-h-72 overflow-auto">
          <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground font-mono">
            {output}
          </pre>
        </div>
      ) : null}
    </BasicTool>
  );
}
ToolRegistry.register('image-gen', ImageGenTool);

// --- VideoGen ---
function VideoGenTool({ part, defaultOpen, forceOpen, locked }: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const prompt = input.prompt as string | undefined;

  return (
    <BasicTool
      icon={<Cpu className="size-3.5 flex-shrink-0" />}
      trigger={{ title: 'Video Gen', subtitle: prompt?.slice(0, 60) }}
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {output && (
        <div data-scrollable className="p-2 max-h-72 overflow-auto">
          <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground font-mono">
            {output}
          </pre>
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('video-gen', VideoGenTool);

// --- PresentationGen ---
interface PresentationOutput {
  success: boolean;
  action: string;
  error?: string;
  presentation_name?: string;
  presentation_path?: string;
  slide_number?: number;
  slide_title?: string;
  slide_file?: string;
  total_slides?: number;
  viewer_url?: string;
  viewer_file?: string;
  message?: string;
}

function parsePresentationOutput(output: string): PresentationOutput | null {
  if (!output) return null;
  try {
    return JSON.parse(output) as PresentationOutput;
  } catch {
    // If output starts with "Error:" it's a string error
    if (output.startsWith('Error:')) {
      return {
        success: false,
        action: 'unknown',
        error: output.replace(/^Error:\s*/, ''),
      };
    }
    return null;
  }
}

function PresentationGenTool({
  part,
  defaultOpen,
  forceOpen,
  locked,
}: ToolProps) {
  const input = partInput(part);
  const output = partOutput(part);
  const status = partStatus(part);
  const running = useContext(ToolRunningContext);
  const action = input.action as string | undefined;
  const presentationName = input.presentation_name as string | undefined;
  const slideTitle = input.slide_title as string | undefined;
  const slideNumber = input.slide_number as number | string | undefined;

  const parsed = useMemo(() => parsePresentationOutput(output), [output]);
  const isError = parsed ? !parsed.success : false;

  // Proxy-rewrite viewer URL so localhost:3210 → subdomain URL
  const { proxyUrl } = useSandboxProxy();
  const viewerProxyUrl = useMemo(() => {
    if (!parsed?.viewer_url) return undefined;
    return proxyUrl(parsed.viewer_url);
  }, [parsed?.viewer_url, proxyUrl]);

  // Build a nice trigger subtitle
  const triggerSubtitle = useMemo(() => {
    if (action === 'create_slide' && slideTitle) {
      return `Slide ${slideNumber || '?'}: ${slideTitle}`;
    }
    if (action === 'preview' || action === 'serve') return presentationName;
    if (action === 'export_pdf') return `${presentationName} → PDF`;
    if (action === 'export_pptx') return `${presentationName} → PPTX`;
    if (action === 'list_slides') return presentationName;
    if (action === 'list_presentations') return 'All presentations';
    if (action === 'delete_slide' || action === 'delete_presentation')
      return presentationName;
    if (action === 'validate_slide') return `Slide ${slideNumber || '?'}`;
    return presentationName || action;
  }, [action, presentationName, slideTitle, slideNumber]);

  // Action label
  const actionLabel = useMemo(() => {
    const labels: Record<string, string> = {
      create_slide: 'Create Slide',
      list_slides: 'List Slides',
      delete_slide: 'Delete Slide',
      list_presentations: 'List',
      delete_presentation: 'Delete',
      validate_slide: 'Validate',
      export_pdf: 'Export PDF',
      export_pptx: 'Export PPTX',
      preview: 'Preview',
      serve: 'Serve',
    };
    return labels[action ?? ''] || action;
  }, [action]);

  return (
    <BasicTool
      icon={<Presentation className="size-3.5 flex-shrink-0" />}
      trigger={
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {actionLabel ? (
            <span className="font-medium text-xs text-foreground whitespace-nowrap">
              {actionLabel}
            </span>
          ) : running ? (
            <span className="h-3 w-20 rounded bg-muted-foreground/10 animate-pulse" />
          ) : null}
          {triggerSubtitle ? (
            <span className="text-muted-foreground text-xs truncate font-mono">
              {triggerSubtitle}
            </span>
          ) : running && actionLabel ? (
            <span className="h-3 w-32 rounded bg-muted-foreground/10 animate-pulse" />
          ) : null}
          {parsed?.success &&
            action === 'create_slide' &&
            parsed.total_slides && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-mono whitespace-nowrap ml-auto flex-shrink-0">
                {parsed.total_slides}{' '}
                {parsed.total_slides === 1 ? 'slide' : 'slides'}
              </span>
            )}
          {viewerProxyUrl && (
            <a
              href={viewerProxyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3 text-muted-foreground/60 hover:text-foreground transition-colors" />
            </a>
          )}
        </div>
      }
      defaultOpen={defaultOpen}
      forceOpen={forceOpen}
      locked={locked}
    >
      {/* Error display */}
      {isError && parsed?.error && (
        <div className="flex items-start gap-2 px-3 py-2 text-xs text-muted-foreground">
          <CircleAlert className="size-3 flex-shrink-0 mt-0.5" />
          <span>{parsed.error}</span>
        </div>
      )}

      {/* Success: show relevant details */}
      {parsed?.success && (
        <div className="px-3 py-2.5 space-y-1.5">
          {/* Slide creation summary */}
          {action === 'create_slide' && (
            <div className="flex items-center gap-2 text-xs">
              <Check className="size-3 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground/80">
                Created slide {parsed.slide_number}
                {parsed.slide_title ? `: ${parsed.slide_title}` : ''}
              </span>
              {parsed.total_slides && (
                <span className="text-muted-foreground/50 ml-auto text-[10px]">
                  ({parsed.total_slides} total)
                </span>
              )}
            </div>
          )}

          {/* Validate slide */}
          {action === 'validate_slide' && (
            <div className="flex items-center gap-2 text-xs">
              <Check className="size-3 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground/80">
                Slide {parsed.slide_number || slideNumber || '?'} validated
              </span>
              {parsed.message &&
                parsed.message !== `Slide ${parsed.slide_number} validated` && (
                  <span className="text-muted-foreground/60 truncate">
                    {parsed.message}
                  </span>
                )}
            </div>
          )}

          {/* Preview — embedded iframe */}
          {(action === 'preview' || action === 'serve') &&
            parsed.viewer_url && (
              <InlineServicePreview
                url={parsed.viewer_url}
                label={`Presentation: ${parsed.presentation_name || presentationName || 'Viewer'}`}
              />
            )}

          {/* Export success */}
          {(action === 'export_pdf' || action === 'export_pptx') && (
            <div className="flex items-center gap-2 text-xs">
              <Check className="size-3 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground/80">
                Exported {parsed.presentation_name || presentationName} to{' '}
                {action === 'export_pdf' ? 'PDF' : 'PPTX'}
              </span>
            </div>
          )}

          {/* Generic fallback for other actions (list, delete, etc.) */}
          {![
            'create_slide',
            'validate_slide',
            'preview',
            'serve',
            'export_pdf',
            'export_pptx',
          ].includes(action as string) && (
            <div className="flex items-center gap-2 text-xs">
              <Check className="size-3 text-emerald-500 flex-shrink-0" />
              <span className="text-foreground/80">
                {parsed.message || `${actionLabel} completed`}
              </span>
            </div>
          )}

          {/* File paths */}
          {parsed.slide_file && action !== 'preview' && action !== 'serve' && (
            <div className="text-[10px] text-muted-foreground/50 font-mono truncate">
              {parsed.slide_file}
            </div>
          )}
        </div>
      )}

      {/* Fallback for unrecognized output */}
      {!parsed && output && (
        <div data-scrollable className="p-2 max-h-72 overflow-auto">
          <pre className="font-mono text-[11px] whitespace-pre-wrap text-muted-foreground/60">
            {output}
          </pre>
        </div>
      )}
    </BasicTool>
  );
}
ToolRegistry.register('presentation-gen', PresentationGenTool);

// --- Show (output to user) — standalone hero card renderer ---
// Uses ShowContentRenderer from file-renderers/ as the single source of truth
// for content rendering. This component only handles the card chrome + Open in Tab.

import {
  ShowContentRenderer,
  ShowCarousel,
  showDomain,
} from '@/components/file-renderers/show-content-renderer';
import type { ShowCarouselItem } from '@/components/file-renderers/show-content-renderer';
import { SHOW_HTML_EXT_RE } from '@/components/file-renderers/show-content-renderer';
import { SANDBOX_PORTS } from '@/lib/platform-client';

const SHOW_BORDER_STYLES: Record<string, string> = {
  default: 'border-border/50',
  success: 'border-emerald-500/20',
  warning: 'border-amber-500/20',
  info: 'border-blue-500/20',
  danger: 'border-red-500/20',
};

function showTypeIcon(type: string, className = 'size-4') {
  switch (type) {
    case 'image':
      return <ImageIcon className={cn(className, 'flex-shrink-0')} />;
    case 'video':
      return <Video className={cn(className, 'flex-shrink-0')} />;
    case 'audio':
      return <Music className={cn(className, 'flex-shrink-0')} />;
    case 'code':
      return <Code2 className={cn(className, 'flex-shrink-0')} />;
    case 'markdown':
      return <Type className={cn(className, 'flex-shrink-0')} />;
    case 'html':
      return <Globe className={cn(className, 'flex-shrink-0')} />;
    case 'pdf':
      return <FileText className={cn(className, 'flex-shrink-0')} />;
    case 'url':
      return <Globe className={cn(className, 'flex-shrink-0')} />;
    case 'error':
      return <AlertTriangle className={cn(className, 'flex-shrink-0')} />;
    case 'file':
      return <FileIcon className={cn(className, 'flex-shrink-0')} />;
    case 'text':
      return <Type className={cn(className, 'flex-shrink-0')} />;
    default:
      return <ExternalLink className={cn(className, 'flex-shrink-0')} />;
  }
}

/** "Open in Tab" handler — opens the right tab type depending on content */
function useShowOpenInTab(props: {
  type: string;
  url: string;
  path: string;
  title: string;
}) {
  const { type, url, path, title } = props;
  const proxy = useProxyUrl(url);
  const hasLocalhostUrl = !!parseLocalhostUrl(url) && !isAppRouteUrl(url);

  // For HTML file paths, build a static-file-server URL and proxy it
  const isHtmlFilePath =
    !!path &&
    SHOW_HTML_EXT_RE.test(path) &&
    (type === 'file' || type === 'html');
  const staticFilePort = parseInt(
    SANDBOX_PORTS.STATIC_FILE_SERVER ?? '3211',
    10,
  );
  const htmlStaticUrl = isHtmlFilePath
    ? `http://localhost:${staticFilePort}/open?path=${encodeURIComponent(ensureWorkspacePath(path))}`
    : '';
  const htmlStaticProxy = useProxyUrl(htmlStaticUrl);

  return useCallback(() => {
    // HTML file path → open as preview tab via static file server
    if (isHtmlFilePath && htmlStaticProxy) {
      const fileName = path.split('/').pop() || path;
      openTabAndNavigate({
        id: `preview:${htmlStaticProxy.port}`,
        title: title || fileName,
        type: 'preview',
        href: `/p/${htmlStaticProxy.port}`,
        metadata: enrichPreviewMetadata({
          url: htmlStaticProxy.proxyUrl,
          port: htmlStaticProxy.port,
          originalUrl: htmlStaticUrl,
        }),
      });
      return;
    }
    if (hasLocalhostUrl && proxy) {
      openTabAndNavigate({
        id: `preview:${proxy.port}`,
        title: title || `localhost:${proxy.port}`,
        type: 'preview',
        href: `/p/${proxy.port}`,
        metadata: enrichPreviewMetadata({
          url: proxy.proxyUrl,
          port: proxy.port,
          originalUrl: url,
        }),
      });
      return;
    }
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (path) {
      const fileName = path.split('/').pop() || path;
      openTabAndNavigate({
        id: `file:${path}`,
        title: fileName,
        type: 'file',
        href: `/files/${encodeURIComponent(path)}`,
      });
    }
  }, [
    isHtmlFilePath,
    htmlStaticProxy,
    htmlStaticUrl,
    hasLocalhostUrl,
    proxy,
    url,
    path,
    title,
  ]);
}

function ShowTool({ part }: ToolProps) {
  const input = partInput(part);
  const running = useContext(ToolRunningContext);

  const title = (input.title as string) || '';
  const description = (input.description as string) || '';
  const type = (input.type as string) || '';
  const path = (input.path as string) || '';
  const url = (input.url as string) || '';
  const content = (input.content as string) || '';
  const aspectRatio = (input.aspect_ratio as string) || '';
  const theme = (input.theme as string) || 'default';
  const language = (input.language as string) || '';

  // ── Parse items[] for multi-item carousel mode ──
  const items = useMemo<ShowCarouselItem[] | null>(() => {
    const raw = input.items;
    if (!raw) return null;
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {
      /* ignore */
    }
    return null;
  }, [input.items]);

  const isCarousel = !!items && items.length > 0;

  // ── Track current carousel item so we can open it ──
  const [carouselIndex, setCarouselIndex] = useState(0);
  const currentItem = isCarousel ? items![carouselIndex] || items![0] : null;

  // Derive the "active" item props — either the single item or the current carousel item
  const activeType = isCarousel ? currentItem?.type || '' : type;
  const activeUrl = isCarousel ? currentItem?.url || '' : url;
  const activePath = isCarousel ? currentItem?.path || '' : path;
  const activeTitle = isCarousel ? currentItem?.title || '' : title;

  const borderStyle = SHOW_BORDER_STYLES[theme] || SHOW_BORDER_STYLES.default;
  const activeHasLocalhostUrl =
    !!parseLocalhostUrl(activeUrl) && !isAppRouteUrl(activeUrl);

  const openInTab = useShowOpenInTab({
    type: activeType,
    url: activeUrl,
    path: activePath,
    title: activeTitle,
  });
  const canOpenInTab = !!(activeUrl || activePath);
  const activeIsHtmlFilePath =
    !!activePath &&
    SHOW_HTML_EXT_RE.test(activePath) &&
    (activeType === 'file' || activeType === 'html');
  const openInTabLabel = activeIsHtmlFilePath
    ? 'Open Preview'
    : activeHasLocalhostUrl
      ? 'Open in Tab'
      : activeUrl
        ? 'Open Link'
        : 'Open File';

  // Loading state
  if (running && !type && !items) {
    return (
      <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
        <div className="flex items-center gap-3 px-5 py-4">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
          <TextShimmer duration={1} spread={2} className="text-sm">
            Preparing output...
          </TextShimmer>
        </div>
      </div>
    );
  }

  const displayTitle = isCarousel
    ? title || `${items!.length} items`
    : title ||
      (type === 'error'
        ? 'Error'
        : type === 'url'
          ? showDomain(url) || 'Link'
          : 'Output');

  const headerIcon = isCarousel ? currentItem?.type || 'image' : type;

  return (
    <div
      className={cn('rounded-xl border overflow-hidden bg-card', borderStyle)}
    >
      {/* ── Header — always neutral colors, never themed ── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border/15">
        <span className="text-muted-foreground">
          {showTypeIcon(headerIcon, 'size-4')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {displayTitle}
          </div>
          {description && (
            <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
              {description}
            </div>
          )}
        </div>
        {isCarousel && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground/60 font-medium flex-shrink-0">
            {items!.length} items
          </span>
        )}
        {canOpenInTab && (
          <button
            type="button"
            onClick={openInTab}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex-shrink-0 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {activeIsHtmlFilePath || activeHasLocalhostUrl ? (
              <MonitorPlay className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
            {openInTabLabel}
          </button>
        )}
      </div>

      {/* ── Content — carousel or single ── */}
      {isCarousel ? (
        <ShowCarousel
          items={items!}
          LocalhostPreview={InlineServicePreview}
          onIndexChange={setCarouselIndex}
        />
      ) : (
        <>
          <ShowContentRenderer
            type={type}
            title={title}
            description={description}
            path={path}
            url={url}
            content={content}
            language={language}
            aspectRatio={aspectRatio}
            LocalhostPreview={InlineServicePreview}
          />
          {description && !title && (
            <div className="px-5 py-3 border-t border-border/15">
              <p className="text-xs text-muted-foreground/70">{description}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
ToolRegistry.register('show', ShowTool);
ToolRegistry.register('show-user', ShowTool); // backward compat
