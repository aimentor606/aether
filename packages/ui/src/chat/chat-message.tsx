'use client';

import React from 'react';
import { cn } from '../lib/utils';

export interface ChatMessageProps {
  /** Message content (text or React nodes) */
  content: React.ReactNode;
  /** Message role — affects alignment and styling */
  role: 'user' | 'assistant' | 'system';
  /** Optional timestamp */
  timestamp?: string;
  /** Optional sender name */
  sender?: string;
  /** Optional avatar element */
  avatar?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Actions to render alongside the message */
  actions?: React.ReactNode;
}

const roleStyles: Record<string, string> = {
  user: 'ml-auto bg-primary text-primary-foreground',
  assistant: 'mr-auto bg-muted text-foreground',
  system: 'mx-auto bg-muted/50 text-muted-foreground italic text-sm',
};

const alignStyles: Record<string, string> = {
  user: 'justify-end',
  assistant: 'justify-start',
  system: 'justify-center',
};

/**
 * A single chat message bubble.
 * Presentational — accepts content via props, no hooks or stores.
 */
export function ChatMessage({
  content,
  role,
  timestamp,
  sender,
  avatar,
  className,
  actions,
}: ChatMessageProps) {
  return (
    <div className={cn('flex gap-2', alignStyles[role], className)}>
      {role === 'assistant' && avatar && (
        <div className="flex-shrink-0 mt-1">{avatar}</div>
      )}
      <div className="flex flex-col gap-1 max-w-[80%]">
        {sender && (
          <span className="text-xs text-muted-foreground">{sender}</span>
        )}
        <div className={cn('rounded-lg px-3 py-2 text-sm', roleStyles[role])}>
          {content}
        </div>
        <div className="flex items-center gap-2">
          {timestamp && (
            <span className="text-xs text-muted-foreground">{timestamp}</span>
          )}
          {actions}
        </div>
      </div>
      {role === 'user' && avatar && (
        <div className="flex-shrink-0 mt-1">{avatar}</div>
      )}
    </div>
  );
}
