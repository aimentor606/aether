'use client';

import React, { useState, useCallback } from 'react';
import type { A2UIBlock, A2UIStreamEvent, A2UICatalog } from '@acme/sdk/a2ui';
import { A2UIRenderer } from './a2ui-renderer';
import type { A2UIRendererProps } from './a2ui-renderer';

export interface A2UIStreamRendererProps {
  /** Stream events to render */
  events: A2UIStreamEvent[];
  /** Component catalog */
  catalog: A2UICatalog<React.ComponentType<Record<string, unknown>>>;
  /** Optional fallback for unknown block types */
  fallback?: A2UIRendererProps['fallback'];
  /** Loading indicator shown while streaming */
  loadingIndicator?: React.ReactNode;
  /** Error handler */
  onError?: (error: string) => void;
}

/**
 * Renders A2UI stream events progressively.
 * Accumulates blocks from 'block' events, shows loading while streaming,
 * and handles 'done' and 'error' events.
 */
export function A2UIStreamRenderer({
  events,
  catalog,
  fallback,
  loadingIndicator,
  onError,
}: A2UIStreamRendererProps) {
  const blocks = extractBlocks(events);
  const isDone = events.some((e) => e.type === 'done');
  const errorEvent = events.find((e) => e.type === 'error');

  if (errorEvent && errorEvent.type === 'error') {
    onError?.(errorEvent.error);
  }

  return React.createElement(
    'div',
    { className: 'a2ui-stream' },
    blocks.length > 0 && React.createElement(A2UIRenderer, { blocks, catalog, fallback }),
    !isDone && !errorEvent && (loadingIndicator ?? React.createElement(DefaultLoadingIndicator)),
    errorEvent &&
      errorEvent.type === 'error' &&
      React.createElement('div', { className: 'text-sm text-destructive' }, errorEvent.error),
  );
}

/**
 * Hook for managing A2UI stream state with incremental event processing.
 */
export function useA2UIStream() {
  const [events, setEvents] = useState<A2UIStreamEvent[]>([]);
  const [blocks, setBlocks] = useState<A2UIBlock[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pushEvent = useCallback((event: A2UIStreamEvent) => {
    setEvents((prev) => [...prev, event]);

    if (event.type === 'block') {
      setBlocks((prev) => appendOrMergeBlock(prev, event.block));
    } else if (event.type === 'done') {
      setIsDone(true);
    } else if (event.type === 'error') {
      setError(event.error);
    }
  }, []);

  const pushEvents = useCallback((newEvents: A2UIStreamEvent[]) => {
    for (const event of newEvents) {
      pushEvent(event);
    }
  }, [pushEvent]);

  const reset = useCallback(() => {
    setEvents([]);
    setBlocks([]);
    setIsDone(false);
    setError(null);
  }, []);

  return { events, blocks, isDone, error, pushEvent, pushEvents, reset };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBlocks(events: A2UIStreamEvent[]): A2UIBlock[] {
  const blocks: A2UIBlock[] = [];
  for (const event of events) {
    if (event.type === 'block') {
      blocks.push(event.block);
    }
  }
  return mergeBlocks(blocks);
}

/**
 * Merge blocks: if a block with the same id appears multiple times,
 * keep the latest version. This handles streaming updates where
 * blocks are progressively filled in.
 */
function mergeBlocks(blocks: A2UIBlock[]): A2UIBlock[] {
  const seen = new Map<string, A2UIBlock>();
  for (const block of blocks) {
    const existing = seen.get(block.id);
    if (existing) {
      seen.set(block.id, { ...existing, ...block });
    } else {
      seen.set(block.id, block);
    }
  }
  return Array.from(seen.values());
}

/**
 * Append a block or merge it into an existing block with the same id.
 */
function appendOrMergeBlock(current: A2UIBlock[], incoming: A2UIBlock): A2UIBlock[] {
  const index = current.findIndex((b) => b.id === incoming.id);
  if (index >= 0) {
    const updated = [...current];
    updated[index] = { ...updated[index], ...incoming };
    return updated;
  }
  return [...current, incoming];
}

function DefaultLoadingIndicator() {
  return React.createElement('div', {
    className: 'flex items-center gap-2 py-2 text-sm text-muted-foreground',
  });
}
