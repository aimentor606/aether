import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { portfolios } from '../schemas';

export const portfoliosRepository = createBaseRepository({ table: portfolios, db });
