'use client';

import React, { useState, useRef, useCallback } from 'react';
import { cn } from '../lib/utils';
import { Button } from '../primitives/button';

export interface ChatInputProps {
  /** Callback when user submits a message */
  onSubmit: (message: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is disabled (e.g., during streaming) */
  disabled?: boolean;
  /** Whether the assistant is currently responding */
  isLoading?: boolean;
  /** Optional file attachment button */
  onAttach?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Optional extra content before the input (e.g., context chips) */
  prefix?: React.ReactNode;
}

/**
 * Chat text input with send button.
 * Presentational — accepts callback via props, no hooks or stores.
 */
export function ChatInput({
  onSubmit,
  placeholder = 'Type a message...',
  disabled = false,
  isLoading = false,
  onAttach,
  className,
  prefix,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed);
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleInput = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, []);

  return (
    <div className={cn('flex items-end gap-2 border-t bg-background p-3', className)}>
      {prefix}
      <div className="flex flex-1 items-end gap-2 rounded-lg border bg-background px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
        />
        {onAttach && (
          <button
            type="button"
            onClick={onAttach}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Attach file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        )}
      </div>
      <Button
        onClick={handleSubmit}
        disabled={disabled || !value.trim()}
        size="sm"
      >
        {isLoading ? '...' : 'Send'}
      </Button>
    </div>
  );
}
