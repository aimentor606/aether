import { litellmConfig } from '../config/litellm-config';
import { resolveVirtualKey } from './litellm-keys';
import type { UsageInfo } from './llm';

export interface LiteLLMProxyOptions {
  body: Record<string, unknown>;
  isStreaming: boolean;
  accountId: string;
  sessionId?: string;
  userApiKey?: string;
}

export async function proxyToLiteLLM(options: LiteLLMProxyOptions): Promise<Response> {
  const { body, isStreaming, accountId, sessionId, userApiKey } = options;

  const virtualKey = await resolveVirtualKey(accountId);
  const url = `${litellmConfig.LITELLM_URL}/v1/chat/completions`;

  const forwardBody = userApiKey
    ? {
        ...body,
        extra_body: {
          ...(isRecord(body.extra_body) ? body.extra_body : {}),
          api_key: userApiKey,
        },
      }
    : body;

  console.info(
    `[LiteLLM] Proxying chat completion (stream=${isStreaming}, accountId=${accountId}, sessionId=${sessionId ?? 'n/a'})`,
  );

  let lastError: unknown;

  for (let attempt = 0; attempt <= litellmConfig.LITELLM_NUM_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), litellmConfig.LITELLM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${virtualKey}`,
        },
        body: JSON.stringify(forwardBody),
        signal: controller.signal,
      });

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= litellmConfig.LITELLM_NUM_RETRIES) {
        break;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

export function extractUsage(responseBody: unknown): UsageInfo | null {
  if (!isRecord(responseBody) || !isRecord(responseBody.usage)) {
    return null;
  }

  const usage = responseBody.usage;
  const details = isRecord(usage.prompt_tokens_details)
    ? usage.prompt_tokens_details
    : null;

  return {
    promptTokens: getNumber(usage.prompt_tokens),
    completionTokens: getNumber(usage.completion_tokens),
    cachedTokens: getNumber(details?.cached_tokens),
    cacheWriteTokens: getNumber(details?.cache_write_tokens),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function getNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}
