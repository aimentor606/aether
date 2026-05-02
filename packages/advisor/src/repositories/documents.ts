import { createDocumentsRepository } from '@aether/vertical-base/shared-repositories';
import { db } from '../db';

export const documentsRepository = createDocumentsRepository(db);
