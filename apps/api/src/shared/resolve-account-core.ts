import { eq } from 'drizzle-orm';
import { accounts, accountMembers, accountUser, billingCustomers, creditAccounts } from '@aether/db';
import { db } from './db';
import { logger } from './logger';

async function syncLegacySubscription(accountId: string): Promise<void> {
  const [existing] = await db
    .select({ tier: creditAccounts.tier })
    .from(creditAccounts)
    .where(eq(creditAccounts.accountId, accountId))
    .limit(1);

  if (existing?.tier && existing.tier !== 'free' && existing.tier !== 'none') return;

  let customerEmail: string | null = null;
  try {
    const [customer] = await db
      .select({ email: billingCustomers.email })
      .from(billingCustomers)
      .where(eq(billingCustomers.accountId, accountId))
      .limit(1);
    customerEmail = customer?.email ?? null;
  } catch (error) {
    logger.warn({ accountId, error }, '[resolve-account] failed to load billing customer email');
  }

  if (!customerEmail) return;

  try {
    const { getStripe } = await import('./stripe');
    const stripe = getStripe();
    const { getTierByPriceId } = await import('../billing/services/tiers');

    const customers = await stripe.customers.search({
      query: `email:'${customerEmail}'`,
      limit: 10,
    });

    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 5,
      });

      for (const sub of subs.data) {
        const priceId = sub.items.data[0]?.price?.id;
        if (!priceId) continue;

        const tierConfig = getTierByPriceId(priceId);
        if (!tierConfig || tierConfig.name === 'free' || tierConfig.name === 'none') continue;
        const tier = tierConfig.name;

        const { upsertCreditAccount } = await import('../billing/repositories/credit-accounts');
        await upsertCreditAccount(accountId, {
          tier,
          stripeSubscriptionId: sub.id,
          stripeSubscriptionStatus: sub.status,
        });

        await db.insert(billingCustomers).values({
          accountId,
          id: customer.id,
          email: customerEmail,
          active: true,
          provider: 'stripe',
        }).onConflictDoNothing();

        console.log(`[resolve-account] Synced Stripe sub ${sub.id} → tier=${tier} for ${accountId} (customer=${customer.id})`);
        return;
      }
    }
  } catch (err) {
    console.warn(`[resolve-account] Stripe sync error for ${accountId}:`, err);
  }
}

async function findMembershipAccountId(userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ accountId: accountMembers.accountId })
    .from(accountMembers)
    .where(eq(accountMembers.userId, userId))
    .limit(1);

  return membership?.accountId ?? null;
}

async function findLegacyAccountId(userId: string): Promise<string | null> {
  const [legacy] = await db
    .select({ accountId: accountUser.accountId })
    .from(accountUser)
    .where(eq(accountUser.userId, userId))
    .limit(1);

  return legacy?.accountId ?? null;
}

async function ensurePrimaryAccountMembership(userId: string, accountId: string): Promise<void> {
  await db.insert(accounts).values({
    accountId,
    name: 'Personal',
    personalAccount: true,
  }).onConflictDoNothing();

  await db.insert(accountMembers).values({
    userId,
    accountId,
    accountRole: 'owner',
  }).onConflictDoNothing();
}

/**
 * Pure account resolution with no side effects.
 */
export async function resolveAccountIdStrict(userId: string): Promise<string> {
  try {
    const membershipAccountId = await findMembershipAccountId(userId);
    if (membershipAccountId) {
      return membershipAccountId;
    }
  } catch (error) {
    logger.warn({ userId, error }, '[resolve-account] membership lookup failed');
  }

  try {
    const legacyAccountId = await findLegacyAccountId(userId);
    if (legacyAccountId) {
      return legacyAccountId;
    }
  } catch (error) {
    logger.warn({ userId, error }, '[resolve-account] legacy lookup failed');
  }

  return userId;
}

/**
 * Optional side-effectful account reconciliation.
 * Keeps legacy lazy-migration behavior explicit at call sites.
 */
export async function reconcileResolvedAccount(userId: string, accountId: string): Promise<void> {
  try {
    await ensurePrimaryAccountMembership(userId, accountId);
  } catch (migErr) {
    logger.warn({ userId, accountId, error: migErr }, '[resolve-account] lazy migration failed');
  }

  syncLegacySubscription(accountId).catch((err) => {
    logger.warn({ accountId, error: err }, '[resolve-account] stripe sync failed');
  });
}
