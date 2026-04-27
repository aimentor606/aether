import { createLeadsRepository } from '@aether/vertical-base/shared-repositories';
import { db } from '../db';

export const leadsRepository = createLeadsRepository(db);
