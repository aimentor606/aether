import { Hono } from 'hono';
import { config } from '../config';
import { apiKeyAuth } from '../middleware/auth';
import { tenantConfigLoader } from '../middleware/tenant-config-loader';
import { webSearch } from './routes/search-web';
import { imageSearch } from './routes/search-image';
import { litellm } from './routes/litellm';
import { litellmAdmin } from './routes/litellm-admin';
import { invoicesRoutes, expensesRoutes, budgetsRoutes, ledgersRoutes } from './routes/finance';
import { proxy } from './routes/proxy';

const router = new Hono();

// Health checks (no auth, no tenant)
router.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aether-router',
    timestamp: new Date().toISOString(),
    env: config.ENV_MODE,
  });
});

// Search routes (apiKeyAuth + tenant)
router.use('/web-search/*', apiKeyAuth);
router.use('/web-search/*', tenantConfigLoader);
router.use('/image-search/*', apiKeyAuth);
router.use('/image-search/*', tenantConfigLoader);
router.route('/web-search', webSearch);
router.route('/image-search', imageSearch);

// LLM routes via LiteLLM Proxy (apiKeyAuth + tenant)
router.use('/chat/*', apiKeyAuth);
router.use('/chat/*', tenantConfigLoader);
router.use('/messages', apiKeyAuth);
router.use('/messages', tenantConfigLoader);
router.use('/models', apiKeyAuth);
router.use('/models/*', apiKeyAuth);
router.route('/', litellm);

// LiteLLM admin routes (apiKeyAuth + tenant)
router.use('/litellm-admin/*', apiKeyAuth);
router.route('/litellm-admin', litellmAdmin);

// Finance routes (apiKeyAuth + tenant)
router.use('/finance/*', apiKeyAuth);
router.use('/finance/*', tenantConfigLoader);
router.route('/finance', invoicesRoutes);
router.route('/finance', expensesRoutes);
router.route('/finance', budgetsRoutes);
router.route('/finance', ledgersRoutes);

// Proxy routes (auth handled internally — dual mode)
router.route('/', proxy);

export { router };
