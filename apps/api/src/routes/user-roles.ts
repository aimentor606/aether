import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../types';
import { supabaseAuth } from '../middleware/auth';

const userRolesApp = new Hono<AppEnv>();

userRolesApp.get('/', supabaseAuth, async (c: Context<AppEnv>) => {
  const { getPlatformRole } = await import('../shared/platform-roles');

  const accountId = c.get('userId') as string;
  const role = await getPlatformRole(accountId);
  const isAdmin = role === 'admin' || role === 'super_admin';

  return c.json({ isAdmin, role });
});

export { userRolesApp };
