import { createBaseService } from '@aether/vertical-base/service';
import { claimsRepository } from '../repositories';
import { createClaimSchema, updateClaimSchema } from '@aether/db';

export const claimsService = createBaseService({
  repository: claimsRepository,
  entityName: 'Claim',
  createSchema: createClaimSchema,
  updateSchema: updateClaimSchema,
});
