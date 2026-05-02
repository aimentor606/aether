import { createBaseService } from '@aether/vertical-base/service';
import { portfoliosRepository } from '../repositories';
import { createPortfolioSchema, updatePortfolioSchema } from '@aether/db';

export const portfoliosService = createBaseService({
  repository: portfoliosRepository,
  entityName: 'Portfolio',
  createSchema: createPortfolioSchema,
  updateSchema: updatePortfolioSchema,
});
