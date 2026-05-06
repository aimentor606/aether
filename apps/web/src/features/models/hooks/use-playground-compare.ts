import { useState, useRef, useCallback } from 'react';
import { useApiClient, streamChatCompletion, useModelPlayground } from '@aether/sdk/client';
import type { ChatMessage } from '@aether/sdk/client';
import type { PlaygroundMessage, TokenUsage } from '../types';

export interface CompareInstance {
  modelId: string;
  messages: PlaygroundMessage[];
  isStreaming: boolean;
  usage?: TokenUsage;
}

export function usePlaygroundCompare() {
  const client = useApiClient();
  const { models } = useModelPlayground(client);
  const modelList = models.data ?? [];

  const [instances, setInstances] = useState<CompareInstance[]>([
    { modelId: modelList[0]?.id ?? '', messages: [], isStreaming: false },
    { modelId: modelList[1]?.id ?? '', messages: [], isStreaming: false },
  ]);
  const [input, setInput] = useState('');
  const abortRefs = useRef<AbortController[]>([]);

  const setInstanceModel = useCallback((index: number, modelId: string) => {
    setInstances((prev) =>
      prev.map((inst, i) => (i === index ? { ...inst, modelId } : inst)),
    );
  }, []);

  const sendToAll = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const anyStreaming = instances.some((inst) => inst.isStreaming);
      if (anyStreaming) return;

      abortRefs.current = [];

      const updatedInstances = instances.map((inst) => {
        if (!inst.modelId) return inst;
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
        return {
          ...inst,
          messages: [...inst.messages, userMsg, assistantMsg],
          isStreaming: true,
          usage: undefined,
        };
      });

      setInstances(updatedInstances);

      for (let i = 0; i < updatedInstances.length; i++) {
        const inst = updatedInstances[i];
        if (!inst.modelId) continue;

        const assistantMsgId = inst.messages[inst.messages.length - 1].id;
        const chatHistory: ChatMessage[] = inst.messages
          .filter((m) => m.content && m.status === 'done')
          .map((m) => ({ role: m.role, content: m.content }));

        streamChatCompletion(
          chatHistory,
          inst.modelId,
          (chunk) => {
            setInstances((prev) =>
              prev.map((p, idx) =>
                idx !== i
                  ? p
                  : {
                      ...p,
                      messages: p.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m,
                      ),
                    },
              ),
            );
          },
          (usage) => {
            setInstances((prev) =>
              prev.map((p, idx) =>
                idx !== i
                  ? p
                  : {
                      ...p,
                      isStreaming: false,
                      usage: usage ?? undefined,
                      messages: p.messages.map((m) =>
                        m.id === assistantMsgId ? { ...m, status: 'done' as const, usage: usage ?? undefined } : m,
                      ),
                    },
              ),
            );
          },
          (error) => {
            setInstances((prev) =>
              prev.map((p, idx) =>
                idx !== i
                  ? p
                  : {
                      ...p,
                      isStreaming: false,
                      messages: p.messages.map((m) =>
                        m.id === assistantMsgId
                          ? { ...m, content: m.content || `Error: ${error}`, status: 'error' as const }
                          : m,
                      ),
                    },
              ),
            );
          },
        ).then((controller) => {
          abortRefs.current[i] = controller;
        });
      }

      setInput('');
    },
    [instances],
  );

  const stopAll = useCallback(() => {
    abortRefs.current.forEach((c) => c?.abort());
    setInstances((prev) =>
      prev.map((inst) => ({
        ...inst,
        isStreaming: false,
        messages: inst.messages.map((m) =>
          m.status === 'streaming' ? { ...m, status: 'done' as const } : m,
        ),
      })),
    );
  }, []);

  const clearAll = useCallback(() => {
    setInstances((prev) =>
      prev.map((inst) => ({ ...inst, messages: [], usage: undefined })),
    );
  }, []);

  const anyStreaming = instances.some((inst) => inst.isStreaming);
  const allModelsSelected = instances.every((inst) => inst.modelId);

  return {
    models: modelList,
    instances,
    input,
    setInput,
    setInstanceModel,
    sendToAll,
    stopAll,
    clearAll,
    anyStreaming,
    allModelsSelected,
  };
}
