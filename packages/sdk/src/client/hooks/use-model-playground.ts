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

export async function streamChatCompletion(
  messages: ChatMessage[],
  modelId: string,
  onChunk: (text: string) => void,
  onDone: (usage?: TokenUsage) => void,
  onError: (error: string) => void,
  onUsage?: (usage: TokenUsage) => void,
  authToken?: string,
): Promise<AbortController> {
  const controller = new AbortController();

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
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      onError(errorText);
      return controller;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response body');
      return controller;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let lastUsage: TokenUsage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          onDone(lastUsage);
          return controller;
        }

        // Check for named event: aether_usage
        if (trimmed.startsWith('event: aether_usage')) continue;

        try {
          const chunk = JSON.parse(data) as ChatCompletionChunk;

          // Extract usage if present (final chunk from stream_options)
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
            return controller;
          }
        } catch {
          // Skip malformed chunks — could be aether_usage event data
          try {
            const parsed = JSON.parse(data);
            if (parsed.promptTokens != null) {
              lastUsage = parsed as TokenUsage;
              onUsage?.(lastUsage);
            }
          } catch {
            // Truly malformed, skip
          }
        }
      }
    }

    onDone(lastUsage);
  } catch (err) {
    if (controller.signal.aborted) return controller;
    onError(err instanceof Error ? err.message : 'Unknown error');
  }

  return controller;
}
