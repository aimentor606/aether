import { useState, useRef, useCallback, useEffect } from 'react';
import {
  useApiClient,
  streamChatCompletion,
  useModelPlayground,
} from '@aether/sdk/client';
import type { ChatMessage } from '@aether/sdk/client';
import type { PlaygroundMessage } from '../types';
import type { TokenUsage } from '@aether/sdk/client';
import { getAuthToken } from '@/lib/auth-token';

export interface CompareInstance {
  id: string;
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
    { id: crypto.randomUUID(), modelId: '', messages: [], isStreaming: false },
    { id: crypto.randomUUID(), modelId: '', messages: [], isStreaming: false },
  ]);
  const [input, setInput] = useState('');
  const abortRefs = useRef<AbortController[]>([]);
  // Track latest instances for chat history without stale closure
  const instancesRef = useRef(instances);
  instancesRef.current = instances;

  // Auto-populate model selectors when models load
  useEffect(() => {
    if (modelList.length === 0) return;
    setInstances((prev) => {
      const needsUpdate = prev.some((inst) => !inst.modelId);
      if (!needsUpdate) return prev;
      return prev.map((inst, i) => {
        if (inst.modelId) return inst;
        const model = modelList[i] ?? modelList[0];
        return { ...inst, modelId: model?.id ?? '' };
      });
    });
  }, [modelList]);

  const setInstanceModel = useCallback((index: number, modelId: string) => {
    setInstances((prev) =>
      prev.map((inst, i) => (i === index ? { ...inst, modelId } : inst)),
    );
  }, []);

  const sendToAll = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Guard against concurrent calls via functional updater
      let blocked = false;
      setInstances((prev) => {
        if (prev.some((inst) => inst.isStreaming)) {
          blocked = true;
          return prev;
        }
        return prev;
      });
      if (blocked) return;

      const token = await getAuthToken();
      abortRefs.current = [];

      // Pre-generate message IDs for callbacks
      const current = instancesRef.current;
      const ids = current.map(() => ({
        user: crypto.randomUUID(),
        assistant: crypto.randomUUID(),
      }));

      setInstances((prev) =>
        prev.map((inst, i) => {
          if (!inst.modelId) return inst;
          return {
            ...inst,
            messages: [
              ...inst.messages,
              {
                id: ids[i].user,
                role: 'user' as const,
                content: trimmed,
                status: 'done' as const,
              },
              {
                id: ids[i].assistant,
                role: 'assistant' as const,
                content: '',
                status: 'streaming' as const,
              },
            ],
            isStreaming: true,
            usage: undefined,
          };
        }),
      );

      current.forEach((inst, i) => {
        if (!inst.modelId) return;

        const assistantId = ids[i].assistant;
        // Build history from ref (latest state), excluding in-flight messages
        const chatHistory: ChatMessage[] = [
          ...inst.messages
            .filter((m) => m.content && m.status === 'done')
            .map((m) => ({ role: m.role, content: m.content })),
          { role: 'user' as const, content: trimmed },
        ];

        // streamChatCompletion returns AbortController synchronously
        const controller = streamChatCompletion(
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
                        m.id === assistantId
                          ? { ...m, content: m.content + chunk }
                          : m,
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
                        m.id === assistantId
                          ? {
                              ...m,
                              status: 'done' as const,
                              usage: usage ?? undefined,
                            }
                          : m,
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
                        m.id === assistantId
                          ? {
                              ...m,
                              content: m.content || `Error: ${error}`,
                              status: 'error' as const,
                            }
                          : m,
                      ),
                    },
              ),
            );
          },
          undefined,
          token ?? undefined,
        );

        abortRefs.current[i] = controller;
      });

      setInput('');
    },
    [], // instancesRef removes the need for `instances` in deps
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
