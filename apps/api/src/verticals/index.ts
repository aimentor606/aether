import { Hono } from 'hono';
import { financeRoutes } from './routes/finance';
import { healthcareRoutes } from './routes/healthcare';
import { retailRoutes } from './routes/retail';

const verticalsApp = new Hono();

// Mount vertical-specific routes
verticalsApp.route('/finance', financeRoutes);
verticalsApp.route('/healthcare', healthcareRoutes);
verticalsApp.route('/retail', retailRoutes);

export { verticalsApp };
