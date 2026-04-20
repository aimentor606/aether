import { Hono } from 'hono';
import { eq, desc, sql, and, ilike, or } from 'drizzle-orm';
import type { AppEnv } from '../../types';

export const sandboxesRoutes = new Hono<AppEnv>();

/** GET /api/instances — list all sandbox instances from DB */
sandboxesRoutes.get('/api/instances', async (c) => {
  try {
    const { db } = await import('../../shared/db');
    const { sandboxes } = await import('@aether/db');

    const rows = await db
      .select()
      .from(sandboxes)
      .orderBy(desc(sandboxes.createdAt));

    const instances = rows.map((row) => ({
      sandbox_id: row.sandboxId,
      external_id: row.externalId,
      name: row.name,
      provider: row.provider,
      base_url: row.baseUrl,
      status: row.status,
      metadata: row.metadata,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    }));

    return c.json({ instances });
  } catch (e: any) {
    return c.json({ instances: [], error: e?.message || String(e) });
  }
});

/** GET /api/sandboxes — list sandboxes with search, filters, pagination */
sandboxesRoutes.get('/api/sandboxes', async (c) => {
  try {
    const { db } = await import('../../shared/db');
    const { sandboxes, accounts } = await import('@aether/db');

    const q        = c.req.query('search')   || '';
    const status   = c.req.query('status')   || '';
    const provider = c.req.query('provider') || '';
    const page     = Math.max(1, parseInt(c.req.query('page')  || '1', 10));
    const limit    = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50', 10)));
    const offset   = (page - 1) * limit;
    const validStatuses = ['provisioning', 'active', 'stopped', 'archived', 'pooled', 'error'] as const;
    const validProviders = ['daytona', 'local_docker', 'justavps'] as const;

    // Build WHERE conditions
    const conditions = [];

    if (validStatuses.includes(status as typeof validStatuses[number])) {
      conditions.push(eq(sandboxes.status, status as typeof validStatuses[number]));
    }
    if (validProviders.includes(provider as typeof validProviders[number])) {
      conditions.push(eq(sandboxes.provider, provider as typeof validProviders[number]));
    }
    if (q) {
      conditions.push(or(
        ilike(sandboxes.sandboxId, `%${q}%`),
        ilike(sandboxes.name, `%${q}%`),
        ilike(accounts.name, `%${q}%`),
        sql`EXISTS (
          SELECT 1 FROM auth.users au
          INNER JOIN aether.account_members am ON am.user_id = au.id
          WHERE am.account_id = ${sandboxes.accountId}
          AND au.email ILIKE ${'%' + q + '%'}
          LIMIT 1
        )`,
      )!);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const ownerEmailSub = sql<string>`(
      SELECT au.email FROM auth.users au
      INNER JOIN aether.account_members am ON am.user_id = au.id
      WHERE am.account_id = ${sandboxes.accountId}
      LIMIT 1
    )`;

    const [rows, [{ total }]] = await Promise.all([
      db
        .select({
          sandboxId: sandboxes.sandboxId,
          accountId: sandboxes.accountId,
          name: sandboxes.name,
          provider: sandboxes.provider,
          externalId: sandboxes.externalId,
          status: sandboxes.status,
          baseUrl: sandboxes.baseUrl,
          metadata: sandboxes.metadata,
          createdAt: sandboxes.createdAt,
          updatedAt: sandboxes.updatedAt,
          lastUsedAt: sandboxes.lastUsedAt,
          accountName: accounts.name,
          ownerEmail: ownerEmailSub,
        })
        .from(sandboxes)
        .leftJoin(accounts, eq(sandboxes.accountId, accounts.accountId))
        .where(where)
        .orderBy(desc(sandboxes.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(sandboxes)
        .leftJoin(accounts, eq(sandboxes.accountId, accounts.accountId))
        .where(where),
    ]);

    return c.json({ sandboxes: rows, total, page, limit });
  } catch (e: any) {
    return c.json({ sandboxes: [], total: 0, page: 1, limit: 50, error: e?.message || String(e) }, 500);
  }
});

/** DELETE /api/sandboxes/:id — delete a sandbox from DB and provider */
sandboxesRoutes.delete('/api/sandboxes/:id', async (c) => {
  try {
    const sandboxId = c.req.param('id');
    const { db } = await import('../../shared/db');
    const { sandboxes } = await import('@aether/db');

    const [row] = await db.select().from(sandboxes).where(eq(sandboxes.sandboxId, sandboxId)).limit(1);
    if (!row) return c.json({ error: 'Sandbox not found' }, 404);

    // Try to delete from provider
    if (row.provider === 'justavps' && row.externalId) {
      try {
        const { config: cfg } = await import('../../config');
        await fetch(`${cfg.JUSTAVPS_API_URL.replace(/\/$/, '')}/machines/${row.externalId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${cfg.JUSTAVPS_API_KEY}` },
        });
      } catch (e: any) {
        console.warn(`[ADMIN] Failed to delete JustAVPS machine ${row.externalId}: ${e?.message}`);
      }
    }

    await db.delete(sandboxes).where(eq(sandboxes.sandboxId, sandboxId));
    return c.json({ success: true, sandboxId });
  } catch (e: any) {
    return c.json({ error: e?.message || String(e) }, 500);
  }
});
