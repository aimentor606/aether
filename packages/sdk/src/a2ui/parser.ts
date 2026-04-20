import type { A2UIBlock, A2UIStreamEvent } from './types';

export function parseA2UIStream(chunk: string): A2UIStreamEvent[] {
  const events: A2UIStreamEvent[] = [];
  const lines = chunk.split('\n');

  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const data = line.slice(6);
    if (data === '[DONE]') {
      events.push({ type: 'done' });
      continue;
    }

    try {
      const parsed = JSON.parse(data) as A2UIBlock;
      events.push({ type: 'block', block: parsed });
    } catch {
      const error = data;
      events.push({ type: 'error', error });
    }
  }

  return events;
}
