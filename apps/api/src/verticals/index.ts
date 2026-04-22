import { Hono } from 'hono';
import { setContextField } from '../lib/request-context';
import { financeRoutes } from './routes/finance';
import { insuranceRoutes } from './routes/insurance';
import { advisorRoutes } from './routes/advisor';

const verticalsApp = new Hono();

// Tag every vertical request with the vertical name for structured logging
verticalsApp.use('/:vertical/*', async (c, next) => {
  const vertical = c.req.param('vertical');
  if (vertical) setContextField('vertical', vertical);
  await next();
});

// Mount vertical-specific routes
verticalsApp.route('/finance', financeRoutes);
verticalsApp.route('/insurance', insuranceRoutes);
verticalsApp.route('/advisor', advisorRoutes);

export { verticalsApp };
