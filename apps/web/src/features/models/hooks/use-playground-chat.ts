import { useState, useRef, useCallback } from 'react';
import { useApiClient, streamChatCompletion, useModelPlayground } from '@aether/sdk/client';
import type { ChatMessage } from '@aether/sdk/client';
import type { PlaygroundMessage, ModelSettings } from '../types';

export function usePlaygroundChat() {
  const client = useApiClient();
  const { models } = useModelPlayground(client);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [settings, setSettings] = useState<ModelSettings>({
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '',
  });
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !selectedModel || isStreaming) return;

      const userMsg: PlaygroundMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        status: 'done',
      };
      const assistantMsg: PlaygroundMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        status: 'streaming',
      };

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);
      setIsStreaming(true);

      const chatHistory: ChatMessage[] = [
        ...(settings.systemPrompt ? [{ role: 'system' as const, content: settings.systemPrompt }] : []),
        ...messages.filter((m) => m.content && m.status === 'done').map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: trimmed },
      ];

      const controller = await streamChatCompletion(
        chatHistory,
        selectedModel,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m,
            ),
          );
        },
        (usage) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, status: 'done' as const, usage: usage ?? undefined } : m,
            ),
          );
          setIsStreaming(false);
        },
        (error) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content || `Error: ${error}`, status: 'error' as const }
                : m,
            ),
          );
          setIsStreaming(false);
        },
      );

      abortRef.current = controller;
    },
    [selectedModel, isStreaming, messages, settings],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((prev) =>
      prev.map((m) => (m.status === 'streaming' ? { ...m, status: 'done' as const } : m)),
    );
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    models,
    selectedModel,
    setSelectedModel,
    messages,
    settings,
    setSettings,
    isStreaming,
    sendMessage,
    stopGeneration,
    clearChat,
  };
}
