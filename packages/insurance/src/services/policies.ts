import { createBaseService } from '@aether/vertical-base/service';
import { policiesRepository } from '../repositories';
import { createPolicySchema, updatePolicySchema } from '@aether/db';

export const policiesService = createBaseService({
  repository: policiesRepository,
  entityName: 'Policy',
  createSchema: createPolicySchema,
  updateSchema: updatePolicySchema,
});
