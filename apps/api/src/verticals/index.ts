import { Hono } from 'hono';
import { configLoader } from './middleware/config-loader';
import { featureFlagsValidator } from './middleware/feature-flags';
import { financeRoutes } from './routes/finance';
import { healthcareRoutes } from './routes/healthcare';
import { retailRoutes } from './routes/retail';

const verticalsApp = new Hono();

// Apply global middleware to all vertical routes
verticalsApp.use('*', configLoader);
verticalsApp.use('*', featureFlagsValidator);

// Mount vertical-specific routes
verticalsApp.route('/finance', financeRoutes);
verticalsApp.route('/healthcare', healthcareRoutes);
verticalsApp.route('/retail', retailRoutes);

export { verticalsApp };
