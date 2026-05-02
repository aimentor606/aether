import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { financialPlans } from '../schemas';

export const financialPlansRepository = createBaseRepository({ table: financialPlans, db });
