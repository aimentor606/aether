import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { resolveAccountId } from '../../shared/resolve-account';

/**
 * Extract accountId from request context.
 * API key auth sets accountId directly. Supabase JWT auth sets userId,
 * which we resolve to accountId via membership lookup.
 */
export async function getAccountId(c: Context): Promise<string> {
  const accountId = c.get('accountId');
  if (accountId) return accountId as string;

  const userId = c.get('userId');
  if (userId) return resolveAccountId(userId as string);

  throw new HTTPException(403, { message: 'Account context required' });
}

export function formatZodError(error: ZodError) {
  return { success: false, error: error.errors };
}
