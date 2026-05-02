import { createDocumentsService } from '@aether/vertical-base/shared-services';
import { documentsRepository } from '../repositories';

export const documentsService = createDocumentsService(documentsRepository);
