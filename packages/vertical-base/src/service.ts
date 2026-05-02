import type { ZodType } from 'zod';
import type { PaginationOptions } from './types';

/**
 * Options for creating a base service.
 */
export interface BaseServiceOptions<TRepo, TEntityName extends string> {
  /** The repository instance (must have standard CRUD methods) */
  repository: TRepo;
  /** Human-readable entity name for error messages (e.g. "Invoice") */
  entityName: TEntityName;
  /** Zod schema for validating create input */
  createSchema: ZodType<any>;
  /** Zod schema for validating update input */
  updateSchema: ZodType<any>;
}

/**
 * Create a base service with standard business logic operations.
 *
 * This factory produces the same `listAll / getById / create / update / delete`
 * pattern shared by every vertical service.  Each method:
 * - validates input via Zod schemas
 * - checks existence before update/delete
 * - throws descriptive errors when entities are not found
 *
 * Domain-specific services can spread the result and override individual methods.
 *
 * @example
 * ```ts
 * import { invoicesRepository } from '../repositories';
 * import { createInvoiceSchema, updateInvoiceSchema } from '@aether/db';
 * import { createBaseService } from '@aether/vertical-base/service';
 *
 * const base = createBaseService({
 *   repository: invoicesRepository,
 *   entityName: 'Invoice',
 *   createSchema: createInvoiceSchema,
 *   updateSchema: updateInvoiceSchema,
 * });
 *
 * export const invoicesService = {
 *   ...base,
 *   // override with domain-specific logic
 * };
 * ```
 */
export function createBaseService<TRepo extends RepositoryShape>({
  repository,
  entityName,
  createSchema,
  updateSchema,
}: BaseServiceOptions<TRepo, string>) {
  return {
    async listAll(accountId: string, options?: PaginationOptions) {
      return repository.findAll(accountId, options);
    },

    async getById(accountId: string, id: string) {
      const entity = await repository.findById(accountId, id);
      if (!entity) {
        throw new Error(`${entityName} ${id} not found`);
      }
      return entity;
    },

    async create(accountId: string, data: unknown) {
      const validated = createSchema.parse(data);
      return repository.create(accountId, validated);
    },

    async update(accountId: string, id: string, data: unknown) {
      const validated = updateSchema.parse(data);
      const existing = await repository.findById(accountId, id);
      if (!existing) {
        throw new Error(`${entityName} ${id} not found`);
      }
      return repository.update(accountId, id, validated);
    },

    async delete(accountId: string, id: string) {
      const existing = await repository.findById(accountId, id);
      if (!existing) {
        throw new Error(`${entityName} ${id} not found`);
      }
      await repository.delete(accountId, id);
    },
  };
}

/**
 * Minimum shape a repository must satisfy for use with `createBaseService`.
 */
export interface RepositoryShape {
  findAll(accountId: string, options?: PaginationOptions): Promise<any>;
  findById(accountId: string, id: string): Promise<any>;
  create(accountId: string, data: any): Promise<any>;
  update(accountId: string, id: string, data: any): Promise<any>;
  delete(accountId: string, id: string): Promise<void>;
}
