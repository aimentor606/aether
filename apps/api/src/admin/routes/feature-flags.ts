import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import type { AppEnv } from '../../types';

export const featureFlagsRoutes = new Hono<AppEnv>();

/** GET /api/feature-flags — list all flags, optionally filtered by account/vertical */
featureFlagsRoutes.get('/api/feature-flags', async (c) => {
  const { db } = await import('../../shared/db');
  const { featureFlags } = await import('@aether/db');
  const accountId = c.req.query('accountId');
  const verticalId = c.req.query('verticalId');

  const conditions = [];
  if (accountId) {
    conditions.push(eq(featureFlags.accountId, accountId));
  }
  if (verticalId) {
    conditions.push(eq(featureFlags.verticalId, verticalId));
  }

  const rows = await db
    .select()
    .from(featureFlags)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(featureFlags.updatedAt));

  return c.json({ success: true, data: rows });
});

/** POST /api/feature-flags — create or update a flag */
featureFlagsRoutes.post('/api/feature-flags', async (c) => {
  const { db } = await import('../../shared/db');
  const { featureFlags } = await import('@aether/db');
  const { invalidateTenantCache } = await import('../../middleware/tenant-config-loader');
  const body = await c.req.json();

  const { accountId, verticalId, featureName, enabled, config: flagConfig } = body;
  if (!accountId || !verticalId || !featureName) {
    return c.json({ success: false, error: 'accountId, verticalId, and featureName are required' }, 400);
  }

  // Upsert: find existing by account+vertical+name
  const [existing] = await db
    .select()
    .from(featureFlags)
    .where(
      and(
        eq(featureFlags.accountId, accountId),
        eq(featureFlags.verticalId, verticalId),
        eq(featureFlags.featureName, featureName),
      ),
    )
    .limit(1);

  let result;
  if (existing) {
    [result] = await db
      .update(featureFlags)
      .set({
        enabled: enabled ?? existing.enabled,
        config: flagConfig ?? existing.config,
        updatedAt: new Date(),
      })
      .where(eq(featureFlags.id, existing.id))
      .returning();
  } else {
    [result] = await db
      .insert(featureFlags)
      .values({
        accountId,
        verticalId,
        featureName,
        enabled: enabled ?? false,
        config: flagConfig ?? null,
      })
      .returning();
  }

  invalidateTenantCache(accountId);
  return c.json({ success: true, data: result });
});

/** DELETE /api/feature-flags/:id — delete a flag */
featureFlagsRoutes.delete('/api/feature-flags/:id', async (c) => {
  const { db } = await import('../../shared/db');
  const { featureFlags } = await import('@aether/db');
  const { invalidateTenantCache } = await import('../../middleware/tenant-config-loader');
  const id = c.req.param('id');

  const [existing] = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.id, id))
    .limit(1);

  if (!existing) {
    return c.json({ success: false, error: 'Feature flag not found' }, 404);
  }

  await db.delete(featureFlags).where(eq(featureFlags.id, id));
  invalidateTenantCache(existing.accountId);
  return c.json({ success: true });
});
