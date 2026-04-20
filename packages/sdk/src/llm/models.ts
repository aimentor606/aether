import type { ApiClient } from '../api/types';
import type { LLMClient, ModelInfo, KeyInfo, UsageStats } from './types';

export function createLLMClient(api: ApiClient): LLMClient {
  return {
    async listModels() {
      const res = await api.get<ModelInfo[]>('/model');
      return res.success ? res.data ?? [] : [];
    },

    async addModel(model: Omit<ModelInfo, 'model_id'>) {
      return api.post<ModelInfo>('/model', model);
    },

    async updateModel(modelId: string, updates: Partial<ModelInfo>) {
      return api.put<ModelInfo>(`/model/${modelId}`, updates);
    },

    async deleteModel(modelId: string) {
      return api.delete<void>(`/model/${modelId}`);
    },

    async listKeys() {
      const res = await api.get<KeyInfo[]>('/key');
      return res.success ? res.data ?? [] : [];
    },

    async createKey(params: { key_alias?: string; max_budget?: number; duration?: string }) {
      return api.post<KeyInfo>('/key', params);
    },

    async deleteKey(keyId: string) {
      return api.delete<void>(`/key/${keyId}`);
    },

    async getUsage(params?: { start_date?: string; end_date?: string }) {
      const query = params
        ? `?start_date=${params.start_date ?? ''}&end_date=${params.end_date ?? ''}`
        : '';
      return api.get<UsageStats>(`/global/spend${query}`);
    },
  };
}
