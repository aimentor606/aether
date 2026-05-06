'use client';

import { useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@aether/ui/primitives';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@aether/ui/primitives';
import { ChatMessageBubble } from './chat-message';
import type { CompareInstance } from '../hooks/use-playground-compare';
import type { PlaygroundModel } from '@aether/sdk/client';

interface ComparePanelProps {
  models: PlaygroundModel[];
  instances: CompareInstance[];
  input: string;
  anyStreaming: boolean;
  allModelsSelected: boolean;
  onInputChange: (value: string) => void;
  onSetModel: (index: number, modelId: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onClear: () => void;
}

export function ComparePanel({
  models,
  instances,
  input,
  anyStreaming,
  allModelsSelected,
  onInputChange,
  onSetModel,
  onSend,
  onStop,
  onClear,
}: ComparePanelProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !anyStreaming && allModelsSelected) {
        onSend(input);
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with model selectors */}
      <div className="px-6 py-3 border-b flex items-center justify-between">
        <h1 className="text-lg font-semibold">Model Compare</h1>
        <Button variant="ghost" size="icon" onClick={onClear} title="Clear all">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Model selectors row */}
      <div className="grid grid-cols-2 gap-px bg-border">
        {instances.map((inst, i) => (
          <div key={inst.id} className="bg-background p-3">
            <Select
              value={inst.modelId}
              onValueChange={(val) => onSetModel(i, val)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select model..." />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Comparison columns */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-border overflow-hidden">
        {instances.map((inst) => (
          <div
            key={inst.id}
            className="bg-background overflow-auto p-4 space-y-4"
          >
            {inst.messages.length === 0 && (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-sm text-muted-foreground">
                  {inst.modelId
                    ? 'Send a message to compare responses'
                    : 'Select a model above'}
                </p>
              </div>
            )}
            {inst.messages.map((msg) => (
              <ChatMessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        ))}
      </div>

      {/* Shared input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              allModelsSelected
                ? 'Send the same prompt to both models...'
                : 'Select models first'
            }
            disabled={!allModelsSelected || anyStreaming}
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
          {anyStreaming ? (
            <Button variant="destructive" onClick={onStop}>
              Stop
            </Button>
          ) : (
            <Button
              onClick={() => {
                if (input.trim() && allModelsSelected) {
                  onSend(input);
                }
              }}
              disabled={!input.trim() || !allModelsSelected}
            >
              Compare
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
