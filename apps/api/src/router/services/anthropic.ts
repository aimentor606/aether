import { litellmConfig } from '../config/litellm-config';
import { AETHER_MARKUP } from '../../config';
import type { ModelConfig } from '../config/models';
import { resolveVirtualKey } from './litellm-keys';

const ANTHROPIC_VERSION = '2023-06-01';

export interface AnthropicUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export async function proxyToAnthropic(
  body: Record<string, unknown>,
  isStreaming: boolean,
): Promise<Response> {
  const virtualKey = await resolveVirtualKey('anthropic-passthrough');
  const url = `${litellmConfig.LITELLM_URL}/v1/messages`;

  console.info(
    `[LiteLLM][Anthropic] Proxying via LiteLLM: ${body.model} (stream=${isStreaming})`,
  );

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${virtualKey}`,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });
}

export function extractAnthropicUsage(responseBody: any): AnthropicUsage | null {
  if (!responseBody?.usage) return null;
  return {
    inputTokens: responseBody.usage.input_tokens ?? 0,
    outputTokens: responseBody.usage.output_tokens ?? 0,
    cacheCreationInputTokens: responseBody.usage.cache_creation_input_tokens ?? 0,
    cacheReadInputTokens: responseBody.usage.cache_read_input_tokens ?? 0,
  };
}

export function calculateAnthropicCost(
  modelConfig: ModelConfig,
  usage: AnthropicUsage,
  markup: number = AETHER_MARKUP,
): number {
  const { inputTokens, outputTokens, cacheCreationInputTokens, cacheReadInputTokens } = usage;

  if (
    (cacheCreationInputTokens > 0 || cacheReadInputTokens > 0) &&
    modelConfig.cacheReadPer1M != null
  ) {
    const regularInputTokens = Math.max(
      0,
      inputTokens - cacheCreationInputTokens - cacheReadInputTokens,
    );
    const regularInputCost = (regularInputTokens / 1_000_000) * modelConfig.inputPer1M;
    const cacheReadCost = (cacheReadInputTokens / 1_000_000) * modelConfig.cacheReadPer1M;
    const cacheWriteCost =
      (cacheCreationInputTokens / 1_000_000) *
      (modelConfig.cacheWritePer1M ?? modelConfig.inputPer1M);
    const outputCost = (outputTokens / 1_000_000) * modelConfig.outputPer1M;
    return (regularInputCost + cacheReadCost + cacheWriteCost + outputCost) * markup;
  }

  const inputCost = (inputTokens / 1_000_000) * modelConfig.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * modelConfig.outputPer1M;
  return (inputCost + outputCost) * markup;
}
