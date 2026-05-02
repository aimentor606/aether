import { config } from '../config';

export function printStartupBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                  Aether API Starting                      ║
╠═══════════════════════════════════════════════════════════╣
║  Port: ${config.PORT.toString().padEnd(49)}║
║  Mode: ${config.ENV_MODE.padEnd(49)}║
║  Env:  ${config.INTERNAL_AETHER_ENV.padEnd(49)}║
╠═══════════════════════════════════════════════════════════╣
║  Services:                                                ║
║    /v1/router     (search, finance)                     ║
║    /v1/billing    (subscriptions, credits, webhooks)       ║
║    /v1/platform   (sandbox lifecycle)                      ║
${config.AETHER_DEPLOYMENTS_ENABLED ? '║    /v1/deployments (deploy lifecycle)                      ║\n' : ''}║    /v1/pipedream   (Pipedream OAuth integrations)           ║
║    /v1/setup      (setup & env management)                 ║
║    /v1/queue      (persistent message queue)               ║
║    /v1/tunnel     (reverse-tunnel to local machines)         ║
║    /v1/p         (sandbox auth + share)                     ║
╠═══════════════════════════════════════════════════════════╣
║  Database:   ${config.DATABASE_URL ? '✓ Configured'.padEnd(42) : '✗ NOT SET'.padEnd(42)}║
║  Supabase:   ${config.SUPABASE_URL ? '✓ Configured'.padEnd(42) : '✗ NOT SET'.padEnd(42)}║
║  Stripe:     ${config.STRIPE_SECRET_KEY ? '✓ Configured'.padEnd(42) : '✗ NOT SET'.padEnd(42)}║
║  Billing:    ${(config.AETHER_BILLING_INTERNAL_ENABLED ? 'ENABLED' : 'DISABLED').padEnd(42)}║
║  Tunnel:     ${(config.TUNNEL_ENABLED ? 'ENABLED' : 'DISABLED').padEnd(42)}║
║  Providers:  ${config.ALLOWED_SANDBOX_PROVIDERS.join(', ').padEnd(42)}║
╚═══════════════════════════════════════════════════════════╝
`);
}
