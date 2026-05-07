'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Input } from '@aether/ui/primitives';
import { Textarea } from '@aether/ui/primitives';
import type { ModelSettings } from '../types';

interface ChatSettingsProps {
  settings: ModelSettings;
  onChange: (settings: ModelSettings) => void;
}

export function ChatSettings({ settings, onChange }: ChatSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
      >
        <span className="text-muted-foreground">Settings</span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Temperature: {settings.temperature.toFixed(1)}
              </label>
              <input
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={settings.temperature}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    temperature: parseFloat(e.target.value),
                  })
                }
                className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Max Tokens
              </label>
              <Input
                type="number"
                value={settings.maxTokens}
                onChange={(e) =>
                  onChange({
                    ...settings,
                    maxTokens: Math.max(
                      1,
                      Math.min(128000, parseInt(e.target.value) || 4096),
                    ),
                  })
                }
                min={1}
                max={128000}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              System Prompt
            </label>
            <Textarea
              value={settings.systemPrompt}
              onChange={(e) =>
                onChange({ ...settings, systemPrompt: e.target.value })
              }
              placeholder="Optional system prompt..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
