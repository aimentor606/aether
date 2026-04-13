'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';

export interface ChatMessageListProps {
  /** Message elements to render */
  children: React.ReactNode;
  /** Whether to auto-scroll to bottom on new messages */
  autoScroll?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Scroll threshold (px) from bottom to trigger auto-scroll */
  scrollThreshold?: number;
}

/**
 * Scrollable message list container with auto-scroll behavior.
 * Wraps ChatMessage components.
 */
export function ChatMessageList({
  children,
  autoScroll = true,
  className,
  scrollThreshold = 100,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!autoScroll || !containerRef.current) return;

    const container = containerRef.current;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    if (distanceFromBottom < scrollThreshold) {
      scrollToBottom();
    }
  }, [children, autoScroll, scrollThreshold, scrollToBottom]);

  return (
    <div
      ref={containerRef}
      className={cn('flex-1 overflow-y-auto px-4 py-3', className)}
    >
      <div className="flex flex-col gap-4">
        {children}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
