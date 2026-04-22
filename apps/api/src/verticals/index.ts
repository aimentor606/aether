import { Hono } from 'hono';
import { setContextField } from '../lib/request-context';
import { financeRoutes } from './routes/finance';
import { healthcareRoutes } from './routes/healthcare';
import { retailRoutes } from './routes/retail';
import { previewOnly } from './middleware/preview-gate';

const verticalsApp = new Hono();

// Tag every vertical request with the vertical name for structured logging
verticalsApp.use('/:vertical/*', async (c, next) => {
  const vertical = c.req.param('vertical');
  if (vertical) setContextField('vertical', vertical);
  await next();
});

// Mount vertical-specific routes
verticalsApp.route('/finance', financeRoutes);
verticalsApp.use('/healthcare/*', previewOnly('healthcare'));
verticalsApp.route('/healthcare', healthcareRoutes);
verticalsApp.use('/retail/*', previewOnly('retail'));
verticalsApp.route('/retail', retailRoutes);

export { verticalsApp };
