import { getModelPricing } from './model-pricing';

// =============================================================================
// Model Registry
// =============================================================================

export type ModelCapability = 'streaming' | 'tools' | 'vision' | 'code' | 'reasoning';

export type ModelCategory = 'chat' | 'code' | 'reasoning' | 'multimodal';

export interface ModelConfig {
  /** The actual model ID to send to LiteLLM Proxy */
  litellmModel: string;
  inputPer1M: number;   // Cost per 1M input tokens (USD)
  outputPer1M: number;  // Cost per 1M output tokens (USD)
  contextWindow: number;
  tier: 'free' | 'paid';
  cacheReadPer1M?: number;   // Cost per 1M cached-read tokens (USD)
  cacheWritePer1M?: number;  // Cost per 1M cache-write tokens (USD)
  /** Human-readable model name */
  displayName?: string;
  /** Short description of the model's strengths */
  description?: string;
  /** Provider/company that owns the model */
  ownedBy?: string;
  /** Category for filtering in the playground */
  category?: ModelCategory;
  /** Capabilities this model supports */
  capabilities?: ModelCapability[];
  /** Maximum output tokens per request */
  maxOutputTokens?: number;
}

export const MODELS: Record<string, ModelConfig> = {
  'minimax/minimax-m2.7': {
    litellmModel: 'minimax/minimax-m2.7',
    inputPer1M: 0.30,
    outputPer1M: 1.20,
    contextWindow: 204800,
    tier: 'free',
    cacheReadPer1M: 0.06,
    displayName: 'MiniMax M2.7',
    description: 'High-performance model with excellent long-context handling and cost efficiency.',
    ownedBy: 'MiniMax',
    category: 'chat',
    capabilities: ['streaming', 'tools', 'code'],
    maxOutputTokens: 16384,
  },
  'z-ai/glm-5-turbo': {
    litellmModel: 'z-ai/glm-5-turbo',
    inputPer1M: 1.20,
    outputPer1M: 4.00,
    contextWindow: 202752,
    tier: 'free',
    cacheReadPer1M: 0.24,
    displayName: 'GLM-5 Turbo',
    description: 'Powerful reasoning model with strong Chinese and English bilingual capabilities.',
    ownedBy: 'Zhipu AI',
    category: 'reasoning',
    capabilities: ['streaming', 'tools', 'code', 'reasoning'],
    maxOutputTokens: 16384,
  },
  'moonshotai/kimi-k2.5': {
    litellmModel: 'moonshotai/kimi-k2.5',
    inputPer1M: 0.45,
    outputPer1M: 2.20,
    contextWindow: 262144,
    tier: 'free',
    cacheReadPer1M: 0.225,
    displayName: 'Kimi K2.5',
    description: 'Ultra-long context model ideal for document analysis and multi-turn conversations.',
    ownedBy: 'Moonshot AI',
    category: 'chat',
    capabilities: ['streaming', 'tools', 'code'],
    maxOutputTokens: 16384,
  },
  'minimax/minimax-m2.5': {
    litellmModel: 'minimax/minimax-m2.5',
    inputPer1M: 0.20,
    outputPer1M: 1.17,
    contextWindow: 196608,
    tier: 'free',
    cacheReadPer1M: 0.10,
    displayName: 'MiniMax M2.5',
    description: 'Cost-effective model with strong general-purpose capabilities.',
    ownedBy: 'MiniMax',
    category: 'chat',
    capabilities: ['streaming', 'tools', 'code'],
    maxOutputTokens: 16384,
  },
};

/**
 * Default model for Aether-managed contexts (cron, memory, etc.)
 * that need a sensible default without user input.
 */

// =============================================================================
// Model Resolution
// =============================================================================

export function getModel(modelId: string): ModelConfig {
  const litellmModel = modelId.startsWith('openrouter/')
    ? modelId.replace('openrouter/', '')
    : modelId;

  const registryEntry = MODELS[modelId] ?? MODELS[litellmModel];

  const livePricing = getModelPricing(modelId) ?? getModelPricing(litellmModel);

  if (livePricing) {
    return {
      litellmModel,
      contextWindow: registryEntry?.contextWindow ?? 128000,
      tier: registryEntry?.tier ?? 'paid',
      cacheReadPer1M: registryEntry?.cacheReadPer1M,
      cacheWritePer1M: registryEntry?.cacheWritePer1M,
      inputPer1M: livePricing.inputPer1M,
      outputPer1M: livePricing.outputPer1M,
    };
  }

  if (registryEntry) {
    return registryEntry;
  }

  return {
    litellmModel,
    inputPer1M: 0,
    outputPer1M: 0,
    contextWindow: 128000,
    tier: 'paid',
  };
}

/**
 * Get all available models for /v1/models endpoint.
 */
export function getAllModels() {
  return Object.entries(MODELS).map(([id, cfg]) => ({
    id,
    object: 'model' as const,
    owned_by: cfg.ownedBy ?? 'aether',
    context_window: cfg.contextWindow,
    max_output_tokens: cfg.maxOutputTokens,
    pricing: {
      input: cfg.inputPer1M,
      output: cfg.outputPer1M,
      cache_read: cfg.cacheReadPer1M,
      cache_write: cfg.cacheWritePer1M,
    },
    tier: cfg.tier,
    category: cfg.category ?? 'chat',
    capabilities: cfg.capabilities ?? ['streaming'],
    display_name: cfg.displayName ?? id,
    description: cfg.description ?? '',
  }));
}
