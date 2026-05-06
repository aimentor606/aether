import type { ChatMessage } from '@aether/sdk/client';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost?: number;
}

export type MessageStatus = 'streaming' | 'done' | 'error';

export interface PlaygroundMessage extends ChatMessage {
  id: string;
  usage?: TokenUsage;
  status: MessageStatus;
}

export interface ModelSettings {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}
