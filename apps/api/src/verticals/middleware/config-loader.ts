import { Context, Next } from 'hono';
import financeConfig from '@acme/vertical-finance';
import healthcareConfig from '@acme/vertical-healthcare';
import retailConfig from '@acme/vertical-retail';

const VERTICAL_CONFIGS = {
  finance: financeConfig,
  healthcare: healthcareConfig,
  retail: retailConfig,
};

export async function configLoader(c: Context, next: Next) {
  const vertical = c.req.param('vertical');

  if (!vertical || !(vertical in VERTICAL_CONFIGS)) {
    return c.json({ error: 'Invalid or missing vertical' }, 400);
  }

  const config = VERTICAL_CONFIGS[vertical as keyof typeof VERTICAL_CONFIGS];
  c.set('verticalConfig', config);
  c.set('vertical', vertical);

  await next();
}
