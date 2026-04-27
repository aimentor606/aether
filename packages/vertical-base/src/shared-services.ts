import { createBaseService } from './service';
import { createLeadSchema, updateLeadSchema, createDocumentSchema, updateDocumentSchema, createComplianceSchema, updateComplianceSchema } from '@aether/db';
import type { RepositoryShape } from './service';

export function createLeadsService(repository: RepositoryShape, defaultVertical: string) {
  const base = createBaseService({
    repository,
    entityName: 'Lead',
    createSchema: createLeadSchema,
    updateSchema: updateLeadSchema,
  });

  return {
    ...base,
    async create(accountId: string, data: unknown) {
      const validated = createLeadSchema.parse(data);
      return repository.create(accountId, { ...validated, vertical: validated.vertical ?? defaultVertical });
    },
  };
}

export function createDocumentsService(repository: RepositoryShape) {
  return createBaseService({
    repository,
    entityName: 'Document',
    createSchema: createDocumentSchema,
    updateSchema: updateDocumentSchema,
  });
}

export function createComplianceService(repository: RepositoryShape) {
  return createBaseService({
    repository,
    entityName: 'Compliance record',
    createSchema: createComplianceSchema,
    updateSchema: updateComplianceSchema,
  });
}
