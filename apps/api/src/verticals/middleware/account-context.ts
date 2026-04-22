import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { resolveAccountIdStrict } from '../../shared/resolve-account';

/**
 * Extract accountId from request context.
 * API key auth sets accountId directly. Supabase JWT auth sets userId,
 * which we resolve to accountId via membership lookup.
 */
export async function getAccountId(c: Context): Promise<string> {
  const accountId = c.get('accountId');
  if (accountId) return accountId as string;

  const userId = c.get('userId');
  if (userId) return resolveAccountIdStrict(userId as string);

  throw new HTTPException(403, { message: 'Account context required' });
}

export function formatZodError(error: ZodError) {
  return { success: false, error: error.errors };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function pagination(c: Context) {
  const rawLimit = Number(c.req.query('limit')) || DEFAULT_LIMIT;
  const rawOffset = Number(c.req.query('offset')) || 0;
  return { limit: Math.min(rawLimit, MAX_LIMIT), offset: Math.max(rawOffset, 0) };
}
