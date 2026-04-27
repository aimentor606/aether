import { createBaseRepository } from '@aether/vertical-base/repository';
import { db } from '../db';
import { riskAssessments } from '../schemas';

export const riskAssessmentsRepository = createBaseRepository({ table: riskAssessments, db, orderByColumn: riskAssessments.assessedAt });
