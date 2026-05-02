import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { policies } from '../schemas';

export const policiesRepository = createBaseRepository({ table: policies, db });
