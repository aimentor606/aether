import type { ChatMessage, TokenUsage } from '@aether/sdk/client';

export type { TokenUsage };
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
