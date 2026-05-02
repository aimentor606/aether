import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { supabaseAuth } from '../middleware/auth';
import { logger as appLogger } from '../lib/logger';

const accountsApp = new Hono<AppEnv>();

accountsApp.get('/', supabaseAuth, async (c: Context<AppEnv>) => {
  const userId = c.get('userId') as string;
  const userEmail = c.get('userEmail') as string;

  const { eq } = await import('drizzle-orm');
  const { accountMembers, accounts, accountUser } = await import('@aether/db');
  const { db } = await import('../shared/db');

  // 1. Try aether.account_members (new table)
  try {
    const memberships = await db
      .select({
        accountId: accountMembers.accountId,
        accountRole: accountMembers.accountRole,
        name: accounts.name,
        personalAccount: accounts.personalAccount,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
      })
      .from(accountMembers)
      .innerJoin(accounts, eq(accountMembers.accountId, accounts.accountId))
      .where(eq(accountMembers.userId, userId));

    if (memberships.length > 0) {
      return c.json(memberships.map(m => ({
        account_id: m.accountId,
        name: m.name || userEmail || 'User',
        slug: m.accountId.slice(0, 8),
        personal_account: m.personalAccount,
        created_at: m.createdAt?.toISOString() ?? new Date().toISOString(),
        updated_at: m.updatedAt?.toISOString() ?? new Date().toISOString(),
        account_role: m.accountRole || 'owner',
        is_primary_owner: m.accountRole === 'owner',
      })));
    }
  } catch (err) {
    appLogger.warn('[accounts] aether.account_members query failed, falling back to basejump', { error: String(err) });
  }

  // 2. Fall back to basejump.account_user (legacy, cloud prod)
  try {
    const legacyMemberships = await db
      .select({
        accountId: accountUser.accountId,
        accountRole: accountUser.accountRole,
      })
      .from(accountUser)
      .where(eq(accountUser.userId, userId));

    if (legacyMemberships.length > 0) {
      return c.json(legacyMemberships.map(m => ({
        account_id: m.accountId,
        name: userEmail || 'User',
        slug: m.accountId.slice(0, 8),
        personal_account: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        account_role: m.accountRole || 'owner',
        is_primary_owner: m.accountRole === 'owner',
      })));
    }
  } catch (err) {
    appLogger.warn('[accounts] basejump.account_user query failed, returning synthetic account', { error: String(err) });
  }

  // 3. No memberships anywhere — return userId as personal account
  return c.json([
    {
      account_id: userId,
      name: userEmail || 'User',
      slug: userId.slice(0, 8),
      personal_account: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      account_role: 'owner',
      is_primary_owner: true,
    },
  ]);
});

export { accountsApp };
