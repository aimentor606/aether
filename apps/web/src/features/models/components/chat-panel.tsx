'use client';

import { useRef, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@aether/ui/primitives';
import { ChatSettings } from './chat-settings';
import { ChatMessageBubble } from './chat-message';
import type { PlaygroundMessage, ModelSettings } from '../types';

interface ChatPanelProps {
  modelId: string;
  modelName: string;
  messages: PlaygroundMessage[];
  settings: ModelSettings;
  isStreaming: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSettingsChange: (settings: ModelSettings) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
}

export function ChatPanel({
  modelId,
  modelName,
  messages,
  settings,
  isStreaming,
  input,
  onInputChange,
  onSettingsChange,
  onSend,
  onStop,
  onClear,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    isNearBottomRef.current =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 50;
  }, []);

  useEffect(() => {
    if (scrollRef.current && isNearBottomRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.trim() && !isStreaming) {
          onSend(input);
        }
      }
    },
    [input, isStreaming, onSend],
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 border-b flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Model Playground</h1>
          <p className="text-sm text-muted-foreground">
            Chat with AI models · Compare responses
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-muted px-2.5 py-1 rounded-full">
            {modelName}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            title="Clear chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings */}
      <ChatSettings settings={settings} onChange={onSettingsChange} />

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-6 space-y-4"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h3 className="text-lg font-medium text-muted-foreground">
              Select a model and start chatting
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Try different models. Responses stream in real-time. Token usage
              and cost are shown after each response.
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessageBubble key={msg.id} message={msg} />
        ))}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={modelId ? `Send a message...` : 'Select a model first'}
            disabled={!modelId || isStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          {isStreaming ? (
            <Button variant="destructive" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (input.trim()) {
                  onSend(input);
                }
              }}
              disabled={!input.trim() || !modelId}
            >
              Send
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
