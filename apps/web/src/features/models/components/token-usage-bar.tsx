'use client';

import { Badge } from '@aether/ui/primitives';
import type { TokenUsage } from '@aether/sdk/client';

interface TokenUsageBarProps {
  usage: TokenUsage | null | undefined;
}

export function TokenUsageBar({ usage }: TokenUsageBarProps) {
  if (!usage) return null;

  return (
    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/50">
      <Badge variant="secondary" className="text-[10px] font-mono">
        {usage.promptTokens.toLocaleString()} in
      </Badge>
      <Badge variant="secondary" className="text-[10px] font-mono">
        {usage.completionTokens.toLocaleString()} out
      </Badge>
      {usage.estimatedCost != null && (
        <Badge
          variant="outline"
          className="text-[10px] font-mono text-emerald-600 border-emerald-200"
        >
          ${usage.estimatedCost.toFixed(4)}
        </Badge>
      )}
    </div>
  );
}
