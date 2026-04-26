import { eq, and, desc } from 'drizzle-orm';
import type { PgTableWithColumns, PgTable } from 'drizzle-orm/pg-core';
import type { PaginationOptions } from './types';
import { DEFAULT_LIMIT, DEFAULT_OFFSET } from './types';

/**
 * Options for creating a base repository.
 */
export interface BaseRepositoryOptions<TTable extends PgTableWithColumns<any>> {
  /** The Drizzle table definition */
  table: TTable;
  /** The Drizzle query-compatible db instance */
  db: {
    query: Record<string, any>;
    insert: (table: any) => any;
    update: (table: any) => any;
    delete: (table: any) => any;
  };
  /** The column to use for ordering (defaults to `createdAt`) */
  orderByColumn?: any;
}

/**
 * Create a base repository with standard CRUD operations.
 *
 * This factory produces the same `findAll / findById / create / update / delete`
 * pattern shared by every vertical repository.  Domain-specific repositories
 * can spread the result and override individual methods as needed.
 *
 * @example
 * ```ts
 * import { db } from '../db';
 * import { invoices } from '../schemas';
 * import { createBaseRepository } from '@aether/vertical-base/repository';
 *
 * const base = createBaseRepository({ table: invoices, db });
 * export const invoicesRepository = {
 *   ...base,
 *   // override create with domain-specific field mapping
 *   async create(accountId, data) { ... },
 * };
 * ```
 */
export function createBaseRepository<TTable extends PgTableWithColumns<any>>({
  table,
  db,
  orderByColumn,
}: BaseRepositoryOptions<TTable>) {
  const tableName = (table as any)[Symbol.for('drizzle:Name')] ?? 'unknown';

  return {
    async findAll(accountId: string, options?: PaginationOptions) {
      return (db.query as any)[tableName].findMany({
        where: eq(table.accountId, accountId),
        orderBy: desc(orderByColumn ?? table.createdAt),
        limit: options?.limit ?? DEFAULT_LIMIT,
        offset: options?.offset ?? DEFAULT_OFFSET,
      });
    },

    async findById(accountId: string, id: string) {
      return (db.query as any)[tableName].findFirst({
        where: and(eq(table.accountId, accountId), eq(table.id, id)),
      });
    },

    async create(accountId: string, data: Record<string, unknown>) {
      const [result] = await db
        .insert(table)
        .values({ accountId, ...data })
        .returning();
      return result;
    },

    async update(accountId: string, id: string, data: Record<string, unknown>) {
      const [result] = await db
        .update(table)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(table.accountId, accountId), eq(table.id, id)))
        .returning();
      return result;
    },

    async delete(accountId: string, id: string) {
      await db
        .delete(table)
        .where(and(eq(table.accountId, accountId), eq(table.id, id)));
    },
  };
}
