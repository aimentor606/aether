import { riskAssessmentsRepository } from '../repositories';
import { createRiskAssessmentSchema, updateRiskAssessmentSchema } from '@aether/db';

export const riskAssessmentsService = {
  async listAll(accountId: string, options?: { limit?: number; offset?: number }) {
    return riskAssessmentsRepository.findAll(accountId, options);
  },

  async getById(accountId: string, id: string) {
    const assessment = await riskAssessmentsRepository.findById(accountId, id);
    if (!assessment) throw new Error(`Risk assessment ${id} not found`);
    return assessment;
  },

  async create(accountId: string, data: unknown) {
    const validated = createRiskAssessmentSchema.parse(data);
    return riskAssessmentsRepository.create(accountId, validated);
  },

  async update(accountId: string, id: string, data: unknown) {
    const validated = updateRiskAssessmentSchema.parse(data);
    const existing = await riskAssessmentsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Risk assessment ${id} not found`);
    return riskAssessmentsRepository.update(accountId, id, validated);
  },

  async delete(accountId: string, id: string) {
    const existing = await riskAssessmentsRepository.findById(accountId, id);
    if (!existing) throw new Error(`Risk assessment ${id} not found`);
    await riskAssessmentsRepository.delete(accountId, id);
  },
};
