import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppContext } from '../../types';
import { getModel, getAllModels, type ModelConfig } from '../config/models';
import { proxyToLiteLLM, extractUsage } from '../services/litellm';
import { calculateCost } from '../services/llm';
import { checkCredits, deductLLMCredits } from '../services/billing';

const litellm = new Hono<{ Variables: AppContext }>();

litellm.post('/chat/completions', async (c) => {
  const accountId = c.get('accountId');

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Invalid JSON body' });
  }

  if (!body.model || typeof body.model !== 'string') {
    throw new HTTPException(400, { message: 'Validation error: model is required' });
  }
  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    throw new HTTPException(400, { message: 'Validation error: messages is required and must be a non-empty array' });
  }

  const modelId = body.model;
  const isStreaming = body.stream === true;
  const sessionId =
    (typeof body.session_id === 'string' ? body.session_id : undefined) ??
    c.req.header('X-Session-ID') ??
    c.get('sandboxId') ??
    c.get('keyId');

  const creditCheck = await checkCredits(accountId);
  if (!creditCheck.hasCredits) {
    throw new HTTPException(402, { message: creditCheck.message || 'Insufficient credits' });
  }

  const modelConfig = getModel(modelId);

  const bodyUserApiKey = typeof body.api_key === 'string' && body.api_key.length > 0 ? body.api_key : undefined;
  const headerUserApiKey = c.req.header('X-User-Api-Key') ?? undefined;
  const userApiKey = bodyUserApiKey ?? headerUserApiKey;

  const { api_key: _removedApiKey, ...proxyBody } = body;

  const response = await proxyToLiteLLM({
    body: proxyBody,
    isStreaming,
    accountId,
    sessionId,
    userApiKey,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[LiteLLM] Upstream error ${response.status}: ${errorBody}`);
    return new Response(errorBody, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'application/json' },
    });
  }

  if (isStreaming) {
    const upstreamBody = response.body;
    if (!upstreamBody) {
      throw new HTTPException(502, { message: 'No response body from upstream' });
    }

    const [clientStream, billingStream] = upstreamBody.tee();
    extractUsageFromStream(billingStream, modelConfig, modelId, accountId, sessionId);

    return new Response(clientStream, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  const responseBody = await response.json();
  const usage = extractUsage(responseBody);
  if (usage) {
    const cost = calculateCost(modelConfig, usage.promptTokens, usage.completionTokens, usage.cachedTokens, usage.cacheWriteTokens);
    deductLLMCredits(
      accountId,
      modelId,
      usage.promptTokens,
      usage.completionTokens,
      cost,
      sessionId,
    ).catch((err) => console.error(`[LiteLLM] Failed to deduct credits for ${modelId}:`, err));
    const cacheInfo = usage.cachedTokens || usage.cacheWriteTokens
      ? ` (cache: ${usage.cachedTokens}read/${usage.cacheWriteTokens}write)`
      : '';
    console.info(`[LiteLLM] ${modelId}: ${usage.promptTokens}/${usage.completionTokens} tokens${cacheInfo}, cost=$${cost.toFixed(6)}`);
  }

  return c.json(responseBody);
});

litellm.get('/models', async (c) => {
  const models = getAllModels();

  return c.json({
    object: 'list',
    data: models.map((m) => ({
      id: m.id,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: m.owned_by,
      context_window: m.context_window,
      pricing: m.pricing,
      tier: m.tier,
    })),
  });
});

async function extractUsageFromStream(
  stream: ReadableStream<Uint8Array>,
  modelConfig: ModelConfig,
  modelId: string,
  accountId: string,
  sessionId?: string,
) {
  try {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let lastUsage: { promptTokens: number; completionTokens: number; cachedTokens: number; cacheWriteTokens: number } | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        try {
          const chunk = JSON.parse(line.slice(6));
          if (chunk.usage) {
            const details = chunk.usage.prompt_tokens_details;
            lastUsage = {
              promptTokens: chunk.usage.prompt_tokens ?? 0,
              completionTokens: chunk.usage.completion_tokens ?? 0,
              cachedTokens: details?.cached_tokens ?? 0,
              cacheWriteTokens: details?.cache_write_tokens ?? 0,
            };
          }
        } catch {
          continue;
        }
      }
    }

    if (lastUsage) {
      const cost = calculateCost(modelConfig, lastUsage.promptTokens, lastUsage.completionTokens, lastUsage.cachedTokens, lastUsage.cacheWriteTokens);
      await deductLLMCredits(
        accountId,
        modelId,
        lastUsage.promptTokens,
        lastUsage.completionTokens,
        cost,
        sessionId,
      );
      const cacheInfo = lastUsage.cachedTokens || lastUsage.cacheWriteTokens
        ? ` (cache: ${lastUsage.cachedTokens}read/${lastUsage.cacheWriteTokens}write)`
        : '';
      console.info(`[LiteLLM] Stream ${modelId}: ${lastUsage.promptTokens}/${lastUsage.completionTokens} tokens${cacheInfo}, cost=$${cost.toFixed(6)}`);
    } else {
      console.warn(`[LiteLLM] Stream ${modelId}: no usage data found in stream — billing skipped`);
    }
  } catch (err) {
    console.error('[LiteLLM] Error extracting usage from stream for billing:', err);
  }
}

export { litellm };
