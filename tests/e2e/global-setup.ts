import { waitForUrl } from './helpers/wait';

const apiBase = process.env.E2E_API_URL || 'http://localhost:13738/v1';
const webBase = process.env.E2E_BASE_URL || 'http://localhost:13737';
const supabaseBase = process.env.E2E_SUPABASE_URL || 'http://localhost:13740';

async function globalSetup() {
  console.log('[global-setup] Checking service health...');

  // Verify all services are reachable before running any tests
  await Promise.all([
    waitForUrl(`${supabaseBase}/health`, 120_000).then(() =>
      console.log('[global-setup] Supabase: OK'),
    ),
    waitForUrl(`${apiBase}/health`, 120_000).then(() =>
      console.log('[global-setup] API: OK'),
    ),
    waitForUrl(webBase, 120_000).then(() =>
      console.log('[global-setup] Web: OK'),
    ),
  ]);

  console.log('[global-setup] All services healthy');
}

export default globalSetup;
