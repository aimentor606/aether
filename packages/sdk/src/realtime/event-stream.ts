import type { EventStream, StreamEvent } from './types';

export function createEventStream(url: string): EventStream {
  const listeners = new Map<string, Set<(event: StreamEvent) => void>>();
  let controller: AbortController | null = null;

  return {
    async start() {
      controller = new AbortController();
      const response = await fetch(url, { signal: controller.signal });

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              this.stop();
              return;
            }
            try {
              const parsed = JSON.parse(data) as StreamEvent;
              const typeListeners = listeners.get(parsed.type);
              if (typeListeners) {
                for (const fn of typeListeners) fn(parsed);
              }
              const allListeners = listeners.get('*');
              if (allListeners) {
                for (const fn of allListeners) fn(parsed);
              }
            } catch {
              // skip malformed JSON lines
            }
          }
        }
      }
    },

    stop() {
      controller?.abort();
      controller = null;
    },

    on(eventType: string, callback: (event: StreamEvent) => void) {
      if (!listeners.has(eventType)) {
        listeners.set(eventType, new Set());
      }
      listeners.get(eventType)!.add(callback);
    },

    off(eventType: string, callback: (event: StreamEvent) => void) {
      listeners.get(eventType)?.delete(callback);
    },
  };
}
