import { createComplianceRepository } from '@aether/vertical-base/shared-repositories';
import { db } from '../db';

export const complianceRepository = createComplianceRepository(db);
