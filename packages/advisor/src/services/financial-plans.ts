import { createBaseService } from '@aether/vertical-base/service';
import { financialPlansRepository } from '../repositories';
import { createFinancialPlanSchema, updateFinancialPlanSchema } from '@aether/db';

export const financialPlansService = createBaseService({
  repository: financialPlansRepository,
  entityName: 'Financial plan',
  createSchema: createFinancialPlanSchema,
  updateSchema: updateFinancialPlanSchema,
});
