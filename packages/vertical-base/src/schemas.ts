import { z } from 'zod';

/**
 * Shared Zod schema for validating UUID identifiers.
 */
export const uuidSchema = z.string().uuid();

/**
 * Shared Zod schema for validating pagination query parameters.
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

/**
 * Shared Zod schema for the common timestamp fields present on every entity.
 */
export const timestampFieldsSchema = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Shared Zod schema for a date-or-string field.
 * Accepts either a Date object or an ISO date string.
 */
export const dateOrStringSchema = z.date().or(z.string());

/**
 * Shared Zod schema for a monetary amount field.
 * Accepts either a string (e.g. "123.45") or a number.
 */
export const amountSchema = z.string().or(z.number());

/**
 * Shared Zod schema for a 3-letter currency code.
 */
export const currencySchema = z.string().length(3).default('USD');

/**
 * Shared Zod schema for generic JSON metadata.
 */
export const metadataSchema = z.record(z.unknown()).optional();

/**
 * Infer the pagination type from the schema.
 */
export type PaginationInput = z.infer<typeof paginationSchema>;
