export interface ModelInfo {
  model_id: string;
  model_name: string;
  litellm_params: {
    model: string;
    api_key?: string;
    api_base?: string;
  };
  model_info?: {
    id?: string;
    mode?: string;
    input_cost_per_token?: number;
    output_cost_per_token?: number;
  };
}

export interface ProviderInfo {
  provider: string;
  models: string[];
  healthy: boolean;
}

export interface KeyInfo {
  key: string;
  key_alias?: string;
  max_budget?: number;
  budget_duration?: string;
  spend: number;
  expires?: string;
  metadata?: Record<string, unknown>;
}

export interface UsageStats {
  total_spend: number;
  by_model: Record<string, { spend: number; requests: number }>;
  by_key: Record<string, { spend: number; requests: number }>;
}

export interface LLMClient {
  listModels(): Promise<ModelInfo[]>;
  addModel(model: Omit<ModelInfo, 'model_id'>): Promise<unknown>;
  updateModel(modelId: string, updates: Partial<ModelInfo>): Promise<unknown>;
  deleteModel(modelId: string): Promise<unknown>;
  listKeys(): Promise<KeyInfo[]>;
  createKey(params: { key_alias?: string; max_budget?: number; duration?: string }): Promise<unknown>;
  deleteKey(keyId: string): Promise<unknown>;
  getUsage(params?: { start_date?: string; end_date?: string }): Promise<unknown>;
}
