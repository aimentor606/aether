import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { AppContext } from '../../types';
import { litellmConfig } from '../config/litellm-config';
import { getAllModels, getModel } from '../config/models';
import { calculateCost } from '../services/llm';

const playground = new Hono<{ Variables: AppContext }>();

// ---------------------------------------------------------------------------
// GET /models — public model catalog for the playground
// ---------------------------------------------------------------------------

playground.get('/models', (c) => {
  const models = getAllModels();
  return c.json({ success: true, data: models });
});

// ---------------------------------------------------------------------------
// POST /chat/completions — proxy to LiteLLM with streaming support
// ---------------------------------------------------------------------------

const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional().default(false),
});

playground.post('/chat/completions', async (c) => {
  const body = await c.req.json();
  const parsed = chatCompletionSchema.safeParse(body);

  if (!parsed.success) {
    throw new HTTPException(400, {
      message: JSON.stringify(parsed.error.errors),
    });
  }

  const { model: modelId, stream, ...params } = parsed.data;
  const modelConfig = getModel(modelId);

  const litellmPayload = {
    ...params,
    model: modelConfig.litellmModel,
    stream,
    ...(stream ? { stream_options: { include_usage: true } } : {}),
  };

  const litellmUrl = `${litellmConfig.LITELLM_URL}/chat/completions`;

  if (stream) {
    return streamSSE(c, async (sseStream) => {
      const response = await fetch(litellmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
        },
        body: JSON.stringify(litellmPayload),
        signal: AbortSignal.timeout(litellmConfig.LITELLM_TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorText = await response.text();
        await sseStream.writeSSE({ data: JSON.stringify({ error: { message: errorText } }) });
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = '';

      try {
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
              await sseStream.writeSSE({ data: '[DONE]' });
              return;
            }
            // Forward chunk to client
            await sseStream.writeSSE({ data });
            // Extract usage from final chunks
            try {
              const chunk = JSON.parse(data);
              if (chunk.usage?.total_tokens) {
                const cost = calculateCost(modelConfig, chunk.usage.prompt_tokens ?? 0, chunk.usage.completion_tokens ?? 0);
                await sseStream.writeSSE({
                  event: 'aether_usage',
                  data: JSON.stringify({
                    promptTokens: chunk.usage.prompt_tokens ?? 0,
                    completionTokens: chunk.usage.completion_tokens ?? 0,
                    totalTokens: chunk.usage.total_tokens,
                    estimatedCost: cost,
                  }),
                });
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    });
  }

  // Non-streaming
  const response = await fetch(litellmUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
    },
    body: JSON.stringify(litellmPayload),
    signal: AbortSignal.timeout(litellmConfig.LITELLM_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new HTTPException(502, {
      message: `LiteLLM error: ${errorText}`,
    });
  }

  const data = await response.json();

  // Enrich response with pricing info and computed cost
  const usage = data.usage;
  const estimatedCost = usage
    ? calculateCost(modelConfig, usage.prompt_tokens ?? 0, usage.completion_tokens ?? 0)
    : undefined;

  const enriched = {
    ...data,
    _aether: {
      modelId,
      pricing: {
        inputPer1M: modelConfig.inputPer1M,
        outputPer1M: modelConfig.outputPer1M,
      },
      ...(usage ? { usage: { promptTokens: usage.prompt_tokens, completionTokens: usage.completion_tokens, totalTokens: usage.total_tokens } } : {}),
      ...(estimatedCost != null ? { estimatedCost } : {}),
    },
  };

  return c.json(enriched);
});

export { playground };
