import { createBaseService } from '@aether/vertical-base/service';
import { documentsRepository } from '../repositories';
import { createDocumentSchema, updateDocumentSchema } from '@aether/db';

export const documentsService = createBaseService({
  repository: documentsRepository,
  entityName: 'Document',
  createSchema: createDocumentSchema,
  updateSchema: updateDocumentSchema,
});
