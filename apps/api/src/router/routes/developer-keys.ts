/**
 * Developer API key management routes (account-scoped).
 *
 * Mounted at /router/developer-keys (via supabaseAuth)
 *
 * Developer keys let users authenticate to the Model Playground API
 * from external code. They are NOT tied to a sandbox — they are
 * account-level credentials with optional model restrictions and rate limits.
 *
 * Routes:
 *   POST   /                → Create a developer key
 *   GET    /                → List all developer keys for the account
 *   PATCH  /:keyId/revoke   → Revoke a developer key
 *   DELETE /:keyId          → Hard-delete a developer key
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { aetherApiKeys } from '@aether/db';
import { db } from '../../shared/db';
import { hashSecretKey, generateApiKeyPair, isApiKeySecretConfigured } from '../../shared/crypto';
import { resolveAccountIdStrict } from '../../shared/resolve-account';
import type { AuthVariables } from '../../types';

const createSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  allowed_models: z.array(z.string()).max(50).optional(),
  rate_limit_per_minute: z.number().int().min(1).max(1000).optional(),
  expires_in_days: z.number().int().min(1).max(365).optional(),
});

export const developerKeys = new Hono<{ Variables: AuthVariables }>();

// ─── POST / ─────────────────────────────────────────────────────────────────
// Create a developer API key (account-scoped, no sandbox).

developerKeys.post('/', async (c) => {
  const userId = c.get('userId');
  const accountId = await resolveAccountIdStrict(userId);

  const body = await c.req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten().fieldErrors }, 400);
  }

  const { title, description, allowed_models, rate_limit_per_minute, expires_in_days } = parsed.data;

  if (!isApiKeySecretConfigured()) {
    return c.json({ error: 'API_KEY_SECRET not configured' }, 500);
  }

  const { publicKey, secretKey } = generateApiKeyPair();
  const secretKeyHash = hashSecretKey(secretKey);

  let expiresAt: Date | null = null;
  if (expires_in_days) {
    expiresAt = new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000);
  }

  try {
    const [row] = await db
      .insert(aetherApiKeys)
      .values({
        accountId,
        publicKey,
        secretKeyHash,
        title,
        description: description ?? null,
        type: 'developer',
        scopes: ['playground'],
        allowedModels: allowed_models ?? null,
        rateLimitPerMinute: rate_limit_per_minute ?? null,
        expiresAt,
      })
      .returning();

    if (!row) {
      return c.json({ error: 'Failed to create developer key' }, 500);
    }

    return c.json({
      success: true,
      data: {
        key_id: row.keyId,
        public_key: row.publicKey,
        secret_key: secretKey,
        title: row.title,
        description: row.description,
        type: row.type,
        status: row.status,
        scopes: row.scopes,
        allowed_models: row.allowedModels,
        rate_limit_per_minute: row.rateLimitPerMinute,
        expires_at: row.expiresAt?.toISOString() ?? null,
        created_at: row.createdAt.toISOString(),
      },
    }, 201);
  } catch (err) {
    console.error('[DEVELOPER-KEYS] Create error:', err);
    return c.json({ error: 'Failed to create developer key' }, 500);
  }
});

// ─── GET / ──────────────────────────────────────────────────────────────────
// List all developer keys for the account (no secrets returned).

developerKeys.get('/', async (c) => {
  const userId = c.get('userId');
  const accountId = await resolveAccountIdStrict(userId);

  try {
    const keys = await db
      .select({
        keyId: aetherApiKeys.keyId,
        publicKey: aetherApiKeys.publicKey,
        title: aetherApiKeys.title,
        description: aetherApiKeys.description,
        status: aetherApiKeys.status,
        scopes: aetherApiKeys.scopes,
        allowedModels: aetherApiKeys.allowedModels,
        rateLimitPerMinute: aetherApiKeys.rateLimitPerMinute,
        expiresAt: aetherApiKeys.expiresAt,
        lastUsedAt: aetherApiKeys.lastUsedAt,
        createdAt: aetherApiKeys.createdAt,
      })
      .from(aetherApiKeys)
      .where(
        and(
          eq(aetherApiKeys.accountId, accountId),
          eq(aetherApiKeys.type, 'developer'),
        ),
      );

    return c.json({
      success: true,
      data: keys.map((k) => ({
        key_id: k.keyId,
        public_key: k.publicKey,
        title: k.title,
        description: k.description,
        status: k.status,
        scopes: k.scopes,
        allowed_models: k.allowedModels,
        rate_limit_per_minute: k.rateLimitPerMinute,
        expires_at: k.expiresAt?.toISOString() ?? null,
        last_used_at: k.lastUsedAt?.toISOString() ?? null,
        created_at: k.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[DEVELOPER-KEYS] List error:', err);
    return c.json({ error: 'Failed to list developer keys' }, 500);
  }
});

// ─── PATCH /:keyId/revoke ──────────────────────────────────────────────────

developerKeys.patch('/:keyId/revoke', async (c) => {
  const userId = c.get('userId');
  const accountId = await resolveAccountIdStrict(userId);
  const keyId = c.req.param('keyId');

  try {
    const result = await db
      .update(aetherApiKeys)
      .set({ status: 'revoked' })
      .where(
        and(
          eq(aetherApiKeys.keyId, keyId),
          eq(aetherApiKeys.accountId, accountId),
          eq(aetherApiKeys.type, 'developer'),
          eq(aetherApiKeys.status, 'active'),
        ),
      )
      .returning({ keyId: aetherApiKeys.keyId });

    if (result.length === 0) {
      return c.json({ error: 'Developer key not found or already revoked' }, 404);
    }

    return c.json({ success: true, message: 'Developer key revoked' });
  } catch (err) {
    console.error('[DEVELOPER-KEYS] Revoke error:', err);
    return c.json({ error: 'Failed to revoke developer key' }, 500);
  }
});

// ─── DELETE /:keyId ────────────────────────────────────────────────────────

developerKeys.delete('/:keyId', async (c) => {
  const userId = c.get('userId');
  const accountId = await resolveAccountIdStrict(userId);
  const keyId = c.req.param('keyId');

  try {
    const result = await db
      .delete(aetherApiKeys)
      .where(
        and(
          eq(aetherApiKeys.keyId, keyId),
          eq(aetherApiKeys.accountId, accountId),
          eq(aetherApiKeys.type, 'developer'),
        ),
      )
      .returning({ keyId: aetherApiKeys.keyId });

    if (result.length === 0) {
      return c.json({ error: 'Developer key not found' }, 404);
    }

    return c.json({ success: true, message: 'Developer key deleted' });
  } catch (err) {
    console.error('[DEVELOPER-KEYS] Delete error:', err);
    return c.json({ error: 'Failed to delete developer key' }, 500);
  }
});
