import { createBaseService } from '@aether/vertical-base/service';
import { complianceRepository } from '../repositories';
import { createComplianceSchema, updateComplianceSchema } from '@aether/db';

export const complianceService = createBaseService({
  repository: complianceRepository,
  entityName: 'Compliance record',
  createSchema: createComplianceSchema,
  updateSchema: updateComplianceSchema,
});
