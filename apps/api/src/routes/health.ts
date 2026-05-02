import { Hono } from 'hono';
import { getTunnelServiceStatus } from '../tunnel';
import { getCacheMetrics } from '../middleware/tenant-config-loader';
import { config } from '../config';

const API_VERSION = process.env.SANDBOX_VERSION || 'dev';

const healthApp = new Hono();

healthApp.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aether-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    env: config.ENV_MODE,
    tunnel: getTunnelServiceStatus(),
    cache: getCacheMetrics(),
  });
});

healthApp.get('/v1/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'aether-api',
    version: API_VERSION,
    timestamp: new Date().toISOString(),
    env: config.ENV_MODE,
    tunnel: getTunnelServiceStatus(),
    cache: getCacheMetrics(),
  });
});

healthApp.get('/v1/system/status', (c) => {
  return c.json({
    maintenanceNotice: { enabled: false },
    technicalIssue: { enabled: false },
    updatedAt: new Date().toISOString(),
  });
});

healthApp.post('/v1/prewarm', (c) => {
  return c.json({ success: true });
});

export { healthApp };
