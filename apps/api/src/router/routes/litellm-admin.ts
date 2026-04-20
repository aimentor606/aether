import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { AppContext } from '../../types';
import { litellmConfig } from '../config/litellm-config';
import { getAllModels } from '../config/models';

const litellmAdmin = new Hono<{ Variables: AppContext }>();

/**
 * Get model catalog from the internal registry.
 */
litellmAdmin.get('/models', (c) => {
  const models = getAllModels();
  return c.json({ success: true, data: models });
});

/**
 * Proxy to LiteLLM /health endpoint.
 */
litellmAdmin.get('/health', async (c) => {
  try {
    const res = await fetch(`${litellmConfig.LITELLM_URL}/health`, {
      headers: { Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}` },
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (error) {
    return c.json({
      success: false,
      data: {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
});

/**
 * Proxy to LiteLLM /model/info to get deployed model details.
 */
litellmAdmin.get('/model/info', async (c) => {
  try {
    const res = await fetch(`${litellmConfig.LITELLM_URL}/model/info`, {
      headers: { Authorization: `Bearer ${litellmConfig.LITELLM_MASTER_KEY}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      throw new Error(`LiteLLM returned ${res.status}`);
    }
    const data = await res.json();
    return c.json({ success: true, data: data.data ?? data });
  } catch (error) {
    throw new HTTPException(502, {
      message: error instanceof Error ? error.message : 'Failed to fetch model info from LiteLLM',
    });
  }
});

export { litellmAdmin };
