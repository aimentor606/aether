import { buildProviderKeySchema } from '../../providers/registry';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface KeyGroup {
  title: string;
  description: string;
  keys: Array<{ key: string; label: string; helpUrl?: string; secret?: boolean }>;
}

// ─── Key Schema ─────────────────────────────────────────────────────────────
// Extended key groups beyond the provider registry. These are platform-level
// keys configured during get-aether.sh setup.

export function getAdminKeySchema(): Record<string, KeyGroup> {
  const schema = buildProviderKeySchema();

  return {
    ...schema,
    billing: {
      title: 'Billing',
      description: 'Stripe and RevenueCat keys for subscription billing.',
      keys: [
        { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key', secret: true },
        { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe Webhook Secret', secret: true },
        { key: 'REVENUECAT_API_KEY', label: 'RevenueCat API Key', secret: true },
        { key: 'REVENUECAT_WEBHOOK_SECRET', label: 'RevenueCat Webhook Secret', secret: true },
      ],
    },
    cloud: {
      title: 'Cloud Provider (Daytona)',
      description: 'Daytona cloud sandbox provisioning.',
      keys: [
        { key: 'DAYTONA_API_KEY', label: 'Daytona API Key', secret: true },
        { key: 'DAYTONA_SERVER_URL', label: 'Daytona Server URL' },
        { key: 'DAYTONA_TARGET', label: 'Daytona Target' },
      ],
    },
    justavps: {
      title: 'Cloud Provider (JustAVPS)',
      description: 'JustAVPS sandbox provisioning.',
      keys: [
        { key: 'JUSTAVPS_API_URL', label: 'JustAVPS API URL' },
        { key: 'JUSTAVPS_API_KEY', label: 'JustAVPS API Key', secret: true },
        { key: 'JUSTAVPS_IMAGE_ID', label: 'Image ID' },
        { key: 'JUSTAVPS_DEFAULT_LOCATION', label: 'Default Location' },
        { key: 'JUSTAVPS_DEFAULT_SERVER_TYPE', label: 'Default Server Type' },
        { key: 'JUSTAVPS_IMAGE_BUILD_LOCATION', label: 'Image Build Location' },
        { key: 'JUSTAVPS_IMAGE_BUILD_SERVER_TYPE', label: 'Image Build Server Type' },
        { key: 'JUSTAVPS_PROXY_DOMAIN', label: 'Proxy Domain' },
        { key: 'JUSTAVPS_WEBHOOK_URL', label: 'Webhook URL' },
        { key: 'JUSTAVPS_WEBHOOK_SECRET', label: 'Webhook Secret', secret: true },
      ],
    },
    sandbox: {
      title: 'Sandbox Configuration',
      description: 'Local sandbox provisioning settings.',
      keys: [
        { key: 'ALLOWED_SANDBOX_PROVIDERS', label: 'Allowed Providers' },
        { key: 'SANDBOX_PORT_BASE', label: 'Sandbox Port Base' },
        { key: 'DOCKER_HOST', label: 'Docker Host' },
        { key: 'INTERNAL_SERVICE_KEY', label: 'Internal Service Key', secret: true },
      ],
    },
    integrations: {
      title: 'Integrations',
      description: 'Pipedream and Slack OAuth integration keys.',
      keys: [
        { key: 'PIPEDREAM_CLIENT_ID', label: 'Pipedream Client ID' },
        { key: 'PIPEDREAM_CLIENT_SECRET', label: 'Pipedream Client Secret', secret: true },
        { key: 'PIPEDREAM_PROJECT_ID', label: 'Pipedream Project ID' },
        { key: 'SLACK_CLIENT_ID', label: 'Slack Client ID' },
        { key: 'SLACK_CLIENT_SECRET', label: 'Slack Client Secret', secret: true },
        { key: 'SLACK_SIGNING_SECRET', label: 'Slack Signing Secret', secret: true },
      ],
    },
    core: {
      title: 'Core Infrastructure',
      description: 'Database, Supabase, and API security keys.',
      keys: [
        { key: 'DATABASE_URL', label: 'Database URL', secret: true },
        { key: 'SUPABASE_URL', label: 'Supabase URL' },
        { key: 'SUPABASE_SERVICE_ROLE_KEY', label: 'Supabase Service Role Key', secret: true },
        { key: 'API_KEY_SECRET', label: 'API Key Hashing Secret', secret: true },
      ],
    },
  };
}

export function getAllAdminKeys(): string[] {
  const schema = getAdminKeySchema();
  const keys: string[] = [];
  for (const group of Object.values(schema)) {
    for (const k of group.keys) {
      keys.push(k.key);
    }
  }
  return keys;
}
