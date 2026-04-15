import { AETHER_MARKUP } from '../../config';
import type { ModelConfig } from '../config/models';

export function calculateCost(
  modelConfig: ModelConfig,
  promptTokens: number,
  completionTokens: number,
  cachedTokens: number = 0,
  cacheWriteTokens: number = 0,
  markup: number = AETHER_MARKUP,
): number {
  if ((cachedTokens > 0 || cacheWriteTokens > 0) && modelConfig.cacheReadPer1M != null) {
    const regularInputTokens = Math.max(0, promptTokens - cachedTokens - cacheWriteTokens);
    const regularInputCost = (regularInputTokens / 1_000_000) * modelConfig.inputPer1M;
    const cacheReadCost = (cachedTokens / 1_000_000) * modelConfig.cacheReadPer1M;
    const cacheWriteCost = (cacheWriteTokens / 1_000_000) * (modelConfig.cacheWritePer1M ?? modelConfig.inputPer1M);
    const outputCost = (completionTokens / 1_000_000) * modelConfig.outputPer1M;
    return (regularInputCost + cacheReadCost + cacheWriteCost + outputCost) * markup;
  }

  const inputCost = (promptTokens / 1_000_000) * modelConfig.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * modelConfig.outputPer1M;
  return (inputCost + outputCost) * markup;
}

export interface UsageInfo {
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  cacheWriteTokens: number;
}

export function extractUsage(responseBody: any): UsageInfo | null {
  if (!responseBody?.usage) return null;
  const details = responseBody.usage.prompt_tokens_details;
  return {
    promptTokens: responseBody.usage.prompt_tokens ?? 0,
    completionTokens: responseBody.usage.completion_tokens ?? 0,
    cachedTokens: details?.cached_tokens ?? 0,
    cacheWriteTokens: details?.cache_write_tokens ?? 0,
  };
}

export { getModel, getAllModels } from '../config/models';
