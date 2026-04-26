import type { SQL } from 'drizzle-orm';

/**
 * Standard pagination options used across all repositories.
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Default pagination values.
 */
export const DEFAULT_LIMIT = 50;
export const DEFAULT_OFFSET = 0;

/**
 * Standard tenant-scoped entity fields present on every vertical table.
 */
export interface TenantEntity {
  id: string;
  accountId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Generic CRUD operation signatures that every vertical repository follows.
 *
 * `TTable` is the Drizzle table type.  `TInsert` / `TUpdate` are the
 * input types typically derived from Zod schemas.
 */
export interface RepositoryOps<TTable, TInsert, TUpdate> {
  findAll(accountId: string, options?: PaginationOptions): Promise<unknown[]>;
  findById(accountId: string, id: string): Promise<unknown | undefined>;
  create(accountId: string, data: TInsert): Promise<unknown>;
  update(accountId: string, id: string, data: TUpdate): Promise<unknown>;
  delete(accountId: string, id: string): Promise<void>;
}

/**
 * Standard service operation signatures.
 */
export interface ServiceOps<T, TInsert, TUpdate> {
  listAll(accountId: string, options?: PaginationOptions): Promise<T[]>;
  getById(accountId: string, id: string): Promise<T>;
  create(accountId: string, data: TInsert): Promise<T>;
  update(accountId: string, id: string, data: TUpdate): Promise<T>;
  delete(accountId: string, id: string): Promise<void>;
}
