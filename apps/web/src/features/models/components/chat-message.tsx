'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { TokenUsageBar } from './token-usage-bar';
import type { PlaygroundMessage } from '../types';

interface ChatMessageProps {
  message: PlaygroundMessage;
}

export function ChatMessageBubble({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isStreaming = message.status === 'streaming';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none [&_pre]:bg-background [&_pre]:border [&_pre]:rounded-md [&_pre]:p-3 [&_code]:text-xs [&_code]:font-mono [&_p]:mb-2 [&_p:last-child]:mb-0">
            {message.content ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            ) : isStreaming ? (
              <span className="inline-block animate-pulse">Thinking...</span>
            ) : null}
          </div>
        )}
        {!isUser && <TokenUsageBar usage={message.usage} />}
      </div>
    </div>
  );
}
