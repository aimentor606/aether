import { createBaseService } from '@aether/vertical-base/service';
import { riskAssessmentsRepository } from '../repositories';
import { createRiskAssessmentSchema, updateRiskAssessmentSchema } from '@aether/db';

export const riskAssessmentsService = createBaseService({
  repository: riskAssessmentsRepository,
  entityName: 'Risk assessment',
  createSchema: createRiskAssessmentSchema,
  updateSchema: updateRiskAssessmentSchema,
});
