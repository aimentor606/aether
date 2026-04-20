import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabaseAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/require-admin';
import { envRoutes } from './routes/env';
import { sandboxesRoutes } from './routes/sandboxes';
import { healthRoutes } from './routes/health';
import { featureFlagsRoutes } from './routes/feature-flags';
import type { AppEnv } from '../types';

export const adminApp = new Hono<AppEnv>();

// ─── Auth ───────────────────────────────────────────────────────────────────
// All admin routes require a valid Supabase JWT AND admin/super_admin role.
adminApp.use('/*', supabaseAuth, requireAdmin);

// ─── API Routes ─────────────────────────────────────────────────────────────
adminApp.route('/', envRoutes);
adminApp.route('/', sandboxesRoutes);
adminApp.route('/', healthRoutes);
adminApp.route('/', featureFlagsRoutes);

// ─── Admin HTML Dashboard ───────────────────────────────────────────────────
adminApp.get('/', (c) => {
  const htmlPath = resolve(dirname(fileURLToPath(import.meta.url)), 'static', 'admin-dashboard.html');
  return c.html(readFileSync(htmlPath, 'utf-8'));
});
