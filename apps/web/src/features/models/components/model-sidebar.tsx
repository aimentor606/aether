'use client';

import { Badge } from '@aether/ui/primitives';
import { ScrollArea } from '@aether/ui/primitives';
import type { PlaygroundModel } from '@aether/sdk/client';

interface ModelSidebarProps {
  models: PlaygroundModel[];
  selectedModel: string;
  onSelect: (modelId: string) => void;
  isLoading?: boolean;
  error?: boolean;
}

export function ModelSidebar({
  models,
  selectedModel,
  onSelect,
  isLoading,
  error,
}: ModelSidebarProps) {
  const current = models.find((m) => m.id === selectedModel);

  return (
    <div className="w-64 border-r flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-sm font-semibold">Models</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {models.length} available
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading && (
            <p className="text-sm text-muted-foreground p-2">
              Loading models...
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive p-2">
              Failed to load models. Please refresh.
            </p>
          )}
          {models.map((model) => (
            <button
              key={model.id}
              onClick={() => onSelect(model.id)}
              data-testid={`model-${model.id}`}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                selectedModel === model.id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'hover:bg-muted text-foreground'
              }`}
            >
              <div className="text-sm font-medium truncate">
                {model.display_name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {model.owned_by} · {model.tier}
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      {current && (
        <div className="p-3 border-t text-xs text-muted-foreground space-y-1.5">
          <div>
            Context: {Math.floor(current.context_window / 1024)}K tokens
          </div>
          <div>
            Pricing: ${current.pricing.input.toFixed(2)} / $
            {current.pricing.output.toFixed(2)} per 1M tokens
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {current.capabilities.map((cap) => (
              <Badge
                key={cap}
                variant="secondary"
                className="text-[10px] px-1.5 py-0"
              >
                {cap}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
