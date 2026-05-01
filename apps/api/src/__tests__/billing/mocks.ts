/**
 * Shared mock factories for billing unit tests.
 *
 * Uses a global mock registry so multiple test files can share
 * the same mock.module() registrations without conflicts.
 */
import { mock } from 'bun:test';

// ─── Global Mock Registry ─────────────────────────────────────────────────────

export const mockRegistry = {
  supabaseRpc: null as ReturnType<typeof createMockSupabaseRpc> | null,
  stripeClient: null as any,

  getCreditAccount: null as ((id: string) => Promise<any>) | null,
  getCreditBalance: null as ((id: string) => Promise<any>) | null,
  updateCreditAccount: null as ((id: string, data: any) => Promise<void>) | null,
  upsertCreditAccount: null as ((id: string, data: any) => Promise<void>) | null,
  getYearlyAccountsDueForRotation: null as (() => Promise<any[]>) | null,

  insertLedgerEntry: null as ((data: any) => Promise<any>) | null,
  getPurchaseByPaymentIntent: null as ((id: string) => Promise<any>) | null,
  updatePurchaseStatus: null as ((...args: any[]) => Promise<void>) | null,

  getCustomerByAccountId: null as ((id: string) => Promise<any>) | null,
  getCustomerByStripeId: null as ((id: string) => Promise<any>) | null,
  upsertCustomer: null as ((data: any) => Promise<void>) | null,

  grantCredits: null as ((...args: any[]) => Promise<void>) | null,
  resetExpiringCredits: null as ((...args: any[]) => Promise<void>) | null,

  provisionSandboxFromCheckout: null as ((...args: any[]) => Promise<any>) | null,

  getActiveDeletionRequest: null as ((id: string) => Promise<any>) | null,
  createDeletionRequest: null as ((...args: any[]) => Promise<any>) | null,
  cancelDeletionRequest: null as ((id: string) => Promise<void>) | null,
  markDeletionCompleted: null as ((id: string) => Promise<void>) | null,
  getScheduledDeletions: null as (() => Promise<any[]>) | null,

  deductCredits: null as ((...args: any[]) => Promise<any>) | null,
  getTransactionsSummary: null as ((...args: any[]) => Promise<any>) | null,
  supabaseFromBuilder: null as ((table: string) => Record<string, any>) | null,
};

// ─── Shared Test Config ────────────────────────────────────────────────────────
// Comprehensive config mock that satisfies both billing and non-billing tests.
// Used by registerGlobalMocks() and imported by other test files (e.g. admin-routes)
// to avoid config mock conflicts (mock.module is first-registration-wins).

export function createTestConfig(overrides: Record<string, any> = {}) {
  return {
    PORT: 8008,
    ENV_MODE: 'cloud',
    INTERNAL_AETHER_ENV: 'staging',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/aether_test',
    SUPABASE_URL: 'http://localhost:54321',
    SUPABASE_SERVICE_ROLE_KEY: 'test-supabase-role-key',
    API_KEY_SECRET: 'test-api-key-secret',
    AETHER_BILLING_INTERNAL_ENABLED: true,
    STRIPE_SECRET_KEY: 'sk_test_123',
    REVENUECAT_WEBHOOK_SECRET: '',
    RECONCILIATION_ENABLED: false,
    ALLOWED_SANDBOX_PROVIDERS: ['local_docker'],
    SANDBOX_IMAGE: 'aether/computer:latest',
    AETHER_LOCAL_IMAGES: false,
    DOCKER_HOST: '',
    SANDBOX_NETWORK: '',
    SANDBOX_PORT_BASE: 14000,
    SANDBOX_CONTAINER_NAME: 'aether-sandbox',
    AETHER_URL: 'http://localhost:8008/v1/router',
    POOL_ENABLED: false,
    POOL_MAX_AGE_HOURS: 24,
    LITELLM_URL: 'http://localhost:4000',
    LITELLM_PUBLIC_URL: 'http://localhost:4000',
    LITELLM_MASTER_KEY: '',
    LITELLM_TIMEOUT_MS: 60000,
    LITELLM_NUM_RETRIES: 3,
    FRONTEND_URL: 'http://localhost:3000',
    CORS_ALLOWED_ORIGINS: '',
    INTEGRATION_AUTH_PROVIDER: '',
    PIPEDREAM_CLIENT_ID: '',
    PIPEDREAM_CLIENT_SECRET: '',
    PIPEDREAM_PROJECT_ID: '',
    PIPEDREAM_ENVIRONMENT: 'development',
    PIPEDREAM_WEBHOOK_SECRET: '',
    TUNNEL_SIGNING_SECRET: '',
    TUNNEL_ENABLED: true,
    TUNNEL_HEARTBEAT_INTERVAL_MS: 30000,
    TUNNEL_HEARTBEAT_MAX_MISSED: 3,
    TUNNEL_RPC_TIMEOUT_MS: 30000,
    TUNNEL_MAX_FILE_SIZE: 10485760,
    TUNNEL_PERMISSION_REQUEST_TTL_MS: 300000,
    TUNNEL_RATE_LIMIT_RPC: 100,
    TUNNEL_RATE_LIMIT_PERM_REQUEST: 20,
    TUNNEL_RATE_LIMIT_WS_CONNECT: 5,
    TUNNEL_RATE_LIMIT_PERM_GRANT: 30,
    TUNNEL_MAX_WS_MESSAGE_SIZE: 5242880,
    TAVILY_API_URL: 'https://api.tavily.com',
    TAVILY_API_KEY: '',
    SERPER_API_URL: 'https://google.serper.dev',
    SERPER_API_KEY: '',
    FIRECRAWL_API_URL: 'https://api.firecrawl.dev',
    FIRECRAWL_API_KEY: '',
    REPLICATE_API_URL: 'https://api.replicate.com',
    REPLICATE_API_TOKEN: '',
    CONTEXT7_API_URL: 'https://context7.com',
    CONTEXT7_API_KEY: '',
    AETHER_DEPLOYMENTS_ENABLED: false,
    FREESTYLE_API_URL: 'https://api.freestyle.sh',
    FREESTYLE_API_KEY: '',
    ANTHROPIC_API_URL: 'https://api.anthropic.com/v1',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_URL: 'https://api.openai.com/v1',
    OPENAI_API_KEY: '',
    XAI_API_URL: 'https://api.x.ai/v1',
    XAI_API_KEY: '',
    GEMINI_API_URL: 'https://generativelanguage.googleapis.com/v1beta',
    GEMINI_API_KEY: '',
    GROQ_API_URL: 'https://api.groq.com/openai/v1',
    GROQ_API_KEY: '',
    DAYTONA_API_KEY: '',
    DAYTONA_SERVER_URL: '',
    DAYTONA_TARGET: '',
    DAYTONA_SNAPSHOT: 'aether-sandbox-vunknown',
    JUSTAVPS_API_URL: 'http://localhost:3001',
    JUSTAVPS_API_KEY: '',
    JUSTAVPS_IMAGE_ID: '',
    JUSTAVPS_DEFAULT_LOCATION: 'hel1',
    JUSTAVPS_DEFAULT_SERVER_TYPE: 'pro',
    JUSTAVPS_PROXY_DOMAIN: 'aether.cloud',
    JUSTAVPS_WEBHOOK_SECRET: '',
    JUSTAVPS_WEBHOOK_URL: '',
    REDIS_URL: '',
    MAILTRAP_API_TOKEN: '',
    MAILTRAP_FROM_EMAIL: 'noreply@aether.dev',
    MAILTRAP_FROM_NAME: 'Aether',
    GITHUB_TOKEN: '',
    SANDBOX_VERSION_OVERRIDE: '',
    AETHER_MASTER_URL: '',
    OPENCODE_URL: '',
    AETHER_DATA_DIR: '',
    INTERNAL_SERVICE_KEY: 'test-service-key',
    SANDBOX_VERSION: 'test',
    isLocal: () => false,
    isCloud: () => true,
    isDaytonaEnabled: () => false,
    isLocalDockerEnabled: () => true,
    isJustAVPSEnabled: () => false,
    isPoolEnabled: () => false,
    getDefaultProvider: () => 'local_docker' as const,
    ...overrides,
  };
}

export function resetMockRegistry() {
  for (const key of Object.keys(mockRegistry) as (keyof typeof mockRegistry)[]) {
    (mockRegistry as any)[key] = null;
  }
}

// ─── registerGlobalMocks (backward-compat no-op) ───────────────────────────
// All mock.module() registrations moved to top-level (end of file). This
// function is kept so existing imports don't break, but it no longer does work.

let _registered = false;
export function registerGlobalMocks() {
  if (_registered) return;
  _registered = true;
}

// ─── Credits RPC Call Tracker ──────────────────────────────────────────────────
// Use in consumer test files to track grantCredits/resetExpiringCredits calls
// via the supabase RPC mock, while keeping assertion format compatible.

export function createCreditsRpcTracker() {
  const grantCreditsCalls: any[] = [];
  const resetExpiringCreditsCalls: any[] = [];
  const rpcCalls: { name: string; params: any }[] = [];

  const supabaseRpc = {
    rpc: (name: string, params?: any) => {
      rpcCalls.push({ name, params });
      if (name === 'atomic_add_credits') {
        grantCreditsCalls.push([
          params?.p_account_id,
          params?.p_amount,
          params?.p_type,
          params?.p_description,
          params?.p_is_expiring,
          params?.p_stripe_event_id,
        ]);
        return Promise.resolve({ data: { success: true }, error: null });
      }
      if (name === 'atomic_reset_expiring_credits') {
        resetExpiringCreditsCalls.push([
          params?.p_account_id,
          params?.p_new_credits,
          params?.p_description,
          params?.p_stripe_event_id,
        ]);
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return { grantCreditsCalls, resetExpiringCreditsCalls, rpcCalls, supabaseRpc };
}

export function createMockCreditAccount(overrides: Record<string, any> = {}) {
  return {
    accountId: 'acc_test_123',
    balance: '100.0000',
    expiringCredits: '80.0000',
    nonExpiringCredits: '20.0000',
    dailyCreditsBalance: '3.00',
    lifetimeGranted: '500.0000',
    lifetimePurchased: '100.0000',
    lifetimeUsed: '400.0000',
    tier: 'tier_6_50',
    provider: 'stripe',
    planType: 'monthly',
    stripeSubscriptionId: 'sub_test_123',
    stripeSubscriptionStatus: 'active',
    billingCycleAnchor: '2025-01-01T00:00:00Z',
    nextCreditGrant: '2025-02-01T00:00:00Z',
    lastGrantDate: '2025-01-01T00:00:00Z',
    lastDailyRefresh: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
    trialStatus: 'none',
    trialEndsAt: null,
    commitmentType: null,
    commitmentEndDate: null,
    scheduledTierChange: null,
    scheduledTierChangeDate: null,
    scheduledPriceId: null,
    lastProcessedInvoiceId: null,
    lastRenewalPeriodStart: null,
    paymentStatus: 'active',
    lastPaymentFailure: null,
    revenuecatCustomerId: null,
    revenuecatSubscriptionId: null,
    revenuecatCancelledAt: null,
    revenuecatCancelAtPeriodEnd: null,
    revenuecatPendingChangeProduct: null,
    revenuecatPendingChangeDate: null,
    revenuecatPendingChangeType: null,
    revenuecatProductId: null,
    isGrandfatheredFree: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── Stripe Mock Objects ──────────────────────────────────────────────────────

export function createMockStripeSubscription(overrides: Record<string, any> = {}) {
  return {
    id: 'sub_test_123',
    customer: 'cus_test_123',
    status: 'active',
    cancel_at_period_end: false,
    cancel_at: null,
    billing_cycle_anchor: Math.floor(Date.now() / 1000) - 86400 * 30,
    current_period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
    current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
    items: {
      data: [
        {
          id: 'si_test_123',
          price: {
            id: 'price_test_123',
            unit_amount: 5000,
            currency: 'usd',
          },
        },
      ],
    },
    metadata: {
      account_id: 'acc_test_123',
      tier_key: 'tier_6_50',
    },
    ...overrides,
  };
}

export function createMockStripeInvoice(overrides: Record<string, any> = {}) {
  return {
    id: 'in_test_123',
    subscription: 'sub_test_123',
    customer: 'cus_test_123',
    billing_reason: 'subscription_cycle',
    amount_total: 5000,
    amount_paid: 5000,
    currency: 'usd',
    status: 'paid',
    period_start: Math.floor(Date.now() / 1000),
    period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
    payment_intent: 'pi_test_123',
    ...overrides,
  };
}

export function createMockStripeCheckoutSession(overrides: Record<string, any> = {}) {
  return {
    id: 'cs_test_123',
    mode: 'subscription',
    subscription: 'sub_test_123',
    customer: 'cus_test_123',
    customer_email: 'test@example.com',
    amount_total: 5000,
    payment_intent: null,
    metadata: {
      account_id: 'acc_test_123',
      tier_key: 'tier_6_50',
      commitment_type: 'monthly',
    },
    ...overrides,
  };
}

let _eventCounter = 0;
export function createMockStripeEvent(type: string, object: any, overrides: Record<string, any> = {}) {
  return {
    id: `evt_test_${++_eventCounter}`,
    type,
    data: { object },
    created: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

export function createMockSupabaseRpc(results: Record<string, { data?: any; error?: any }> = {}) {
  return {
    rpc: (name: string, params?: any) => {
      const result = results[name];
      if (result) {
        return Promise.resolve(result);
      }
      return Promise.resolve({ data: null, error: null });
    },
  };
}

export function createMockStripeClient(overrides: Record<string, any> = {}) {
  const defaultSubscription = createMockStripeSubscription();

  return {
    webhooks: {
      constructEvent: overrides.constructEvent ?? ((body: string, sig: string, secret: string) => {
        return JSON.parse(body);
      }),
    },
    subscriptions: {
      retrieve: overrides.subscriptionsRetrieve ?? (async (id: string) => defaultSubscription),
      update: overrides.subscriptionsUpdate ?? (async (id: string, params: any) => ({
        ...defaultSubscription,
        ...params,
      })),
      create: overrides.subscriptionsCreate ?? (async (params: any) => defaultSubscription),
      cancel: overrides.subscriptionsCancel ?? (async (id: string) => ({})),
    },
    customers: {
      create: overrides.customersCreate ?? (async (params: any) => ({
        id: 'cus_new_123',
        email: params.email,
        metadata: params.metadata,
      })),
      retrieve: overrides.customersRetrieve ?? (async (id: string) => ({
        id,
        invoice_settings: { default_payment_method: null },
      })),
    },
    prices: {
      retrieve: overrides.pricesRetrieve ?? (async (id: string) => ({
        id,
        unit_amount: 5000,
        currency: 'usd',
        recurring: { interval: 'month' },
      })),
    },
    paymentMethods: {
      list: overrides.paymentMethodsList ?? (async () => ({ data: [] })),
    },
    checkout: {
      sessions: {
        create: overrides.checkoutSessionsCreate ?? (async (params: any) => ({
          id: 'cs_new_123',
          url: 'https://checkout.stripe.com/test',
          ...params,
        })),
        retrieve: overrides.checkoutSessionsRetrieve ?? (async (id: string) => createMockStripeCheckoutSession()),
      },
    },
    billingPortal: {
      sessions: {
        create: overrides.portalSessionsCreate ?? (async (params: any) => ({
          url: 'https://billing.stripe.com/test',
        })),
      },
    },
    promotionCodes: {
      list: overrides.promotionCodesList ?? (async () => ({ data: [] })),
    },
    invoices: {
      retrieveUpcoming: overrides.invoicesRetrieveUpcoming ?? (async () => ({
        amount_due: 2500,
        currency: 'usd',
        subscription_proration_date: Math.floor(Date.now() / 1000),
      })),
    },
    subscriptionSchedules: {
      create: overrides.subscriptionSchedulesCreate ?? (async (params: any) => ({
        id: 'sub_sched_test_123',
        subscription: params.from_subscription ?? 'sub_test_123',
        status: 'active',
        phases: [],
        metadata: {},
      })),
      update: overrides.subscriptionSchedulesUpdate ?? (async (id: string, params: any) => ({
        id,
        status: 'active',
        ...params,
      })),
      retrieve: overrides.subscriptionSchedulesRetrieve ?? (async (id: string) => ({
        id,
        status: 'active',
        phases: [],
        metadata: {},
      })),
      release: overrides.subscriptionSchedulesRelease ?? (async (id: string) => ({
        id,
        status: 'released',
      })),
    },
    ...overrides.extra,
  };
}

export function createMockRevenueCatEvent(type: string, overrides: Record<string, any> = {}) {
  return {
    event: {
      type,
      app_user_id: overrides.app_user_id ?? 'acc_test_123',
      product_id: overrides.product_id ?? 'aether_pro_monthly',
      subscriber_id: overrides.subscriber_id ?? 'sub_rc_123',
      price: overrides.price ?? 50,
      expiration_at_ms: overrides.expiration_at_ms ?? null,
      effective_date: overrides.effective_date ?? null,
      new_product_id: overrides.new_product_id ?? null,
      ...overrides,
    },
  };
}

// ─── Top-Level Mock Registrations ──────────────────────────────────────────
// Registered at module load time so they're active before any test runs.
// These run after all function declarations above are hoisted.

mock.module('../../shared/supabase', () => ({
  getSupabase: () => ({
    rpc: (name: string, params?: any) => {
      if (mockRegistry.supabaseRpc) return mockRegistry.supabaseRpc.rpc(name, params);
      return Promise.resolve({ data: null, error: null });
    },
    from: (table: string) => {
      if (mockRegistry.supabaseFromBuilder) return mockRegistry.supabaseFromBuilder(table);
      const builder: Record<string, any> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.maybeSingle = () => Promise.resolve({ data: null });
      builder.upsert = () => Promise.resolve({ data: null, error: null });
      return builder;
    },
  }),
}));

mock.module('../../shared/stripe', () => ({
  getStripe: () => mockRegistry.stripeClient ?? createMockStripeClient(),
}));

mock.module('../../config', () => ({
  config: createTestConfig(),
  SANDBOX_VERSION: 'test',
}));

mock.module('../../billing/repositories/credit-accounts', () => ({
  getCreditAccount: async (id: string) =>
    mockRegistry.getCreditAccount ? mockRegistry.getCreditAccount(id) : createMockCreditAccount(),
  getCreditBalance: async (id: string) => {
    if (mockRegistry.getCreditBalance) return mockRegistry.getCreditBalance(id);
    const a = createMockCreditAccount();
    return { balance: a.balance, expiringCredits: a.expiringCredits, nonExpiringCredits: a.nonExpiringCredits, dailyCreditsBalance: a.dailyCreditsBalance, tier: a.tier };
  },
  updateCreditAccount: async (id: string, data: any) =>
    mockRegistry.updateCreditAccount ? mockRegistry.updateCreditAccount(id, data) : undefined,
  upsertCreditAccount: async (id: string, data: any) =>
    mockRegistry.upsertCreditAccount ? mockRegistry.upsertCreditAccount(id, data) : undefined,
  updateBalance: async () => {},
  getSubscriptionInfo: async () => null,
  getYearlyAccountsDueForRotation: async () =>
    mockRegistry.getYearlyAccountsDueForRotation ? mockRegistry.getYearlyAccountsDueForRotation() : [],
}));

mock.module('../../billing/repositories/transactions', () => ({
  insertLedgerEntry: async (data: any) =>
    mockRegistry.insertLedgerEntry ? mockRegistry.insertLedgerEntry(data) : { id: 'ledger_test', ...data },
  getTransactions: async () => ({ rows: [], total: 0 }),
  getTransactionsSummary: async (...args: any[]) =>
    mockRegistry.getTransactionsSummary ? mockRegistry.getTransactionsSummary(...args) : { totalCredits: 0, totalDebits: 0, count: 0 },
  getUsageRecords: async () => ({ rows: [], total: 0 }),
  insertPurchase: async () => null,
  getPurchaseByPaymentIntent: async (id: string) =>
    mockRegistry.getPurchaseByPaymentIntent ? mockRegistry.getPurchaseByPaymentIntent(id) : null,
  updatePurchaseStatus: async (...args: any[]) =>
    mockRegistry.updatePurchaseStatus ? mockRegistry.updatePurchaseStatus(...args) : undefined,
}));

mock.module('../../billing/repositories/customers', () => ({
  getCustomerByAccountId: async (id: string) => {
    if (mockRegistry.getCustomerByAccountId) return mockRegistry.getCustomerByAccountId(id);
    return { id: 'cus_test_123', accountId: 'acc_test_123', email: 'test@example.com', provider: 'stripe', active: true };
  },
  getCustomerByStripeId: async (id: string) => {
    if (mockRegistry.getCustomerByStripeId) return mockRegistry.getCustomerByStripeId(id);
    return { id: 'cus_test_123', accountId: 'acc_test_123', email: 'test@example.com', provider: 'stripe', active: true };
  },
  upsertCustomer: async (data: any) =>
    mockRegistry.upsertCustomer ? mockRegistry.upsertCustomer(data) : undefined,
}));

mock.module('../../platform/services/sandbox-provisioner', () => ({
  provisionSandboxFromCheckout: async (...args: any[]) =>
    mockRegistry.provisionSandboxFromCheckout ? mockRegistry.provisionSandboxFromCheckout(...args) : undefined,
  archiveSandboxBySubscription: async (...args: any[]) => {},
}));

mock.module('../../billing/repositories/account-deletion', () => ({
  getActiveDeletionRequest: async (id: string) =>
    mockRegistry.getActiveDeletionRequest ? mockRegistry.getActiveDeletionRequest(id) : null,
  createDeletionRequest: async (...args: any[]) =>
    mockRegistry.createDeletionRequest ? mockRegistry.createDeletionRequest(...args) : null,
  cancelDeletionRequest: async (id: string) =>
    mockRegistry.cancelDeletionRequest ? mockRegistry.cancelDeletionRequest(id) : undefined,
  markDeletionCompleted: async (id: string) =>
    mockRegistry.markDeletionCompleted ? mockRegistry.markDeletionCompleted(id) : undefined,
  getScheduledDeletions: async () =>
    mockRegistry.getScheduledDeletions ? mockRegistry.getScheduledDeletions() : [],
}));

// Pre-load the real credits service. Dep mocks above ensure it resolves with
// mocked deps, so billing tests exercise real logic on fake data.
// IMPORTANT: capture function refs before registering the mock — the namespace
// object is a live binding that would otherwise point back to the mock itself.
const _realCredits = await import('../../billing/services/credits');
const _realGetBalance = _realCredits.getBalance;
const _realGetCreditSummary = _realCredits.getCreditSummary;
const _realCalculateTokenCost = _realCredits.calculateTokenCost;
const _realGrantCredits = _realCredits.grantCredits;
const _realResetExpiringCredits = _realCredits.resetExpiringCredits;
const _realDeductCredits = _realCredits.deductCredits;

mock.module('../../billing/services/credits', () => ({
  getBalance: _realGetBalance as any,
  getCreditSummary: _realGetCreditSummary as any,
  calculateTokenCost: _realCalculateTokenCost as any,
  grantCredits: _realGrantCredits as any,
  resetExpiringCredits: _realResetExpiringCredits as any,
  deductCredits: (...args: any[]) =>
    mockRegistry.deductCredits
      ? mockRegistry.deductCredits(...args)
      : (_realDeductCredits as any)(...args),
}));
