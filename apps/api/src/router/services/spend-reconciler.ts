import { litellmConfig } from '../config/litellm-config';
import { getSupabase } from '../../shared/supabase';
import { deductCredits } from '../../billing/services/credits';

interface KeyInfo {
  key_alias?: string;
  spend?: number;
  max_budget?: number | null;
  [key: string]: unknown;
}

const AETHER_ALIAS_PREFIX = 'aether-';

export async function reconcileSpend(): Promise<{
  processed: number;
  skipped: number;
  errors: number;
}> {
  const supabase = getSupabase();

  const response = await fetch(`${litellmConfig.LITELLM_URL}/key/list`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `[Reconciler] LiteLLM key list failed: ${response.status} ${body}`,
    );
  }

  const payload = (await response.json()) as { keys?: KeyInfo[]; data?: KeyInfo[] };
  const keys: KeyInfo[] = payload.keys ?? payload.data ?? [];
  const aetherKeys = keys.filter(
    (k) => k.key_alias?.startsWith(AETHER_ALIAS_PREFIX),
  );

  if (aetherKeys.length === 0) {
    return { processed: 0, skipped: 0, errors: 0 };
  }

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const keyInfo of aetherKeys) {
    try {
      const accountId = keyInfo.key_alias!.slice(AETHER_ALIAS_PREFIX.length);
      const currentSpend = Number(keyInfo.spend) || 0;

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
    } catch (err) {
      console.error(
        `[Reconciler] Error processing key ${keyInfo.key_alias}:`,
        err,
      );
      errors++;
    }
  }

  return { processed, skipped, errors };
}
