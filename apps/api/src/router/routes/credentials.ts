import { Hono } from 'hono';
import { z } from 'zod';
import { resolveVirtualKey, syncKeyBudget } from '../services/litellm-keys';
import { getBalance } from '../../billing/services/credits';
import { litellmConfig } from '../config/litellm-config';

type Variables = {
  accountId: string;
  userId: string;
  userEmail: string;
};

export const credentialsApp = new Hono<{ Variables: Variables }>();

const CredentialResponseSchema = z.object({
  litellm_url: z.string().url(),
  api_key: z.string().min(1),
  key_alias: z.string().min(1),
});

credentialsApp.get('/credentials', async (c) => {
  const accountId = c.get('accountId');
  if (!accountId) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  try {
    const apiKey = await resolveVirtualKey(accountId);

    const { balance } = await getBalance(accountId);
    await syncKeyBudget(accountId, balance);

    const response = CredentialResponseSchema.parse({
      litellm_url: litellmConfig.LITELLM_PUBLIC_URL,
      api_key: apiKey,
      key_alias: `aether-${accountId}`,
    });

    return c.json({ success: true, data: response });
  } catch (err: any) {
    if (err?.message?.includes('LiteLLM') || err?.code === 'ECONNREFUSED') {
      return c.json(
        { success: false, error: 'LLM gateway unavailable. Please try again.' },
        502,
      );
    }
    return c.json(
      { success: false, error: err?.message || 'Failed to issue credentials' },
      500,
    );
  }
});
