'use client';

import { cn } from '../lib/utils';

export interface ChatTypingIndicatorProps {
  /** Whether the indicator is visible */
  visible?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Animated typing indicator (three dots).
 * Shown while the assistant is generating a response.
 */
export function ChatTypingIndicator({ visible = true, className }: ChatTypingIndicatorProps) {
  if (!visible) return null;

  return (
    <div className={cn('flex items-center gap-1 px-3 py-2', className)}>
      <span className="text-xs text-muted-foreground mr-1">Thinking</span>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
          style={{
            animation: `typing-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes typing-bounce {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
