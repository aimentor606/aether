import { useQuery } from '@tanstack/react-query';
import type { ApiClient } from '../../api/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PlaygroundModel {
  id: string;
  object: 'model';
  owned_by: string;
  context_window: number;
  max_output_tokens?: number;
  pricing: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  tier: 'free' | 'paid';
  category: 'chat' | 'code' | 'reasoning' | 'multimodal';
  capabilities: string[];
  display_name: string;
  description: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionChunk {
  id: string;
  object: string;
  choices?: Array<{
    index: number;
    delta?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

// ─── Hooks factory ──────────────────────────────────────────────────────────

export function useModelPlayground(client: ApiClient) {
  const models = useQuery<PlaygroundModel[]>({
    queryKey: ['model-playground', 'models'],
    queryFn: async () => {
      const res = await client.get<PlaygroundModel[]>('/router/playground/models');
      return res.data ?? [];
    },
  });

  return { models };
}

// ─── Streaming helper (not a hook — called imperatively) ────────────────────

export interface StreamChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export function streamChatCompletion(
  messages: ChatMessage[],
  modelId: string,
  onChunk: (text: string) => void,
  onDone: (usage?: TokenUsage) => void,
  onError: (error: string) => void,
  onUsage?: (usage: TokenUsage) => void,
  authToken?: string,
  options?: StreamChatOptions,
): AbortController {
  const controller = new AbortController();

  // Start streaming in background; return controller immediately so caller can abort
  (async () => {
    try {
      const response = await fetch('/v1/router/playground/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          ...(options?.temperature != null ? { temperature: options.temperature } : {}),
          ...(options?.maxTokens != null ? { max_tokens: options.maxTokens } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        let errorMsg = `Request failed (${response.status})`;
        try {
          const json = JSON.parse(text);
          errorMsg = json.error || json.message || errorMsg;
        } catch {
          if (text.length > 0 && text.length < 200) errorMsg = text;
        }
        onError(errorMsg);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        onError('No response body');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let lastUsage: TokenUsage | undefined;
      let currentEvent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          // Track SSE event type
          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7);
            continue;
          }

          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);

          if (data === '[DONE]') {
            onDone(lastUsage);
            return;
          }

          // Handle aether_usage named event
          if (currentEvent === 'aether_usage') {
            try {
              const parsed = JSON.parse(data);
              if (parsed.promptTokens != null) {
                lastUsage = parsed as TokenUsage;
                onUsage?.(lastUsage);
              }
            } catch {
              // Malformed usage data
            }
            currentEvent = '';
            continue;
          }

          currentEvent = '';

          try {
            const chunk = JSON.parse(data) as ChatCompletionChunk;

            if (chunk.usage?.total_tokens) {
              lastUsage = {
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              };
            }

            const content = chunk.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
            if (chunk.choices?.[0]?.finish_reason === 'stop') {
              onDone(lastUsage);
              return;
            }
          } catch {
            // Malformed chunk
          }
        }
      }

      onDone(lastUsage);
    } catch (err) {
      if (controller.signal.aborted) return;
      onError(err instanceof Error ? err.message : 'Unknown error');
    }
  })();

  return controller;
}
