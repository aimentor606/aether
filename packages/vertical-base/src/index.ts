// DB - tenant-aware database proxy
export { createTenantDb } from './db';
export type { Database } from './db';

// Repository - base CRUD factory
export { createBaseRepository } from './repository';
export type { BaseRepositoryOptions } from './repository';

// Service - base business logic factory
export { createBaseService } from './service';
export type { BaseServiceOptions } from './service';

// Schemas - shared Zod schemas
export {
  uuidSchema,
  paginationSchema,
  timestampFieldsSchema,
  dateOrStringSchema,
  amountSchema,
  currencySchema,
  metadataSchema,
} from './schemas';
export type { PaginationInput } from './schemas';

// Types - shared type utilities
export type {
  PaginationOptions,
  TenantEntity,
  RepositoryOps,
  ServiceOps,
} from './types';
export { DEFAULT_LIMIT, DEFAULT_OFFSET } from './types';
