import { config } from '../../config';
import { getSupabase } from '../../shared/supabase';
import { deductCredits } from '../../billing/services/credits';
import { queryUsage } from '../../shared/openmeter';
import { logger } from '../../lib/logger';

const METER_SLUG = 'litellm_tokens';

export async function reconcileSpend(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  if (!config.OPENMETER_URL) {
    return { processed: 0, skipped: 0, errors: 0 };
  }

  const supabase = getSupabase();

  // Query all accounts with credit accounts that need reconciliation
  const { data: accounts, error: accountsError } = await supabase
    .from('credit_accounts')
    .select('account_id')
    .limit(500);

  if (accountsError || !accounts?.length) {
    logger.error('[Reconciler] Failed to fetch accounts', { error: String(accountsError) });
    return { processed: 0, skipped: 0, errors: 0 };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const { account_id: accountId } of accounts) {
    try {
      // Query OpenMeter for this account's total usage
      const usageData = await queryUsage(METER_SLUG, {
        subject: accountId,
        windowSize: 'DAY',
      });

      // OpenMeter returns aggregated value; sum all windows
      const currentSpend = usageData
        ? usageData.reduce((sum, p) => sum + (p.value ?? 0), 0)
        : null;

      if (currentSpend === null) {
        // OpenMeter unavailable for this subject — skip (pause, no fallback)
        skipped++;
        continue;
      }

      const { data: stateRow } = await supabase
        .from('spend_reconciliation_state')
        .select('last_spend_usd')
        .eq('account_id', accountId)
        .maybeSingle();

      const lastSpend = Number(stateRow?.last_spend_usd) || 0;
      const delta = currentSpend - lastSpend;

      if (delta > 0) {
        await deductCredits(
          accountId,
          delta,
          `LLM spend reconciliation: +$${delta.toFixed(4)}`,
        );
        processed++;
      } else {
        skipped++;
      }

      await supabase.from('spend_reconciliation_state').upsert(
        {
          account_id: accountId,
          last_spend_usd: currentSpend,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' },
      );
    } catch (err: unknown) {
      logger.error(
        `[Reconciler] Error processing account ${accountId}:`,
        err as Record<string, unknown>,
      );
      errors++;
    }
  }

  return { processed, skipped, errors };
}
