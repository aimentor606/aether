import { Context, Next } from 'hono';

export async function featureFlagsValidator(c: Context, next: Next) {
  const config = c.get('verticalConfig');
  const vertical = c.get('vertical');

  if (!config) {
    return c.json({ error: 'Vertical config not loaded' }, 500);
  }

  c.set('featureFlags', config.featureFlags || []);

  await next();
}

export function isFeatureFlagEnabled(
  c: Context,
  flagName: string
): boolean {
  const featureFlags = c.get('featureFlags') || [];
  return featureFlags.includes(flagName);
}
