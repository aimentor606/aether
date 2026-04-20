# Aether SaaS Product Strategy: Architecture Design
**Date**: April 12, 2026  
**Approach**: Single Codebase Multi-Tenant (Approach 1)  
**Status**: Design Phase (Awaiting Approval)

---

## Executive Summary

This document specifies the architecture for Aether as a multi-tenant B2B SaaS platform supporting multiple vertical industries (finance, healthcare, retail, etc.). Each vertical gets customized UI, workflows, and capabilities while maintaining a **single upstream fork** and **minimal sync overhead**.

**Key Design Decisions**:
- ✅ One monorepo fork from aimentor606/aether
- ✅ All verticals coexist via config + feature flags (no code forks)
- ✅ Multi-tenant database model (existing accountId + sandboxId)
- ✅ Tenant-scoped configuration loader replaces direct env reads
- ✅ Per-vertical scaffolding in `packages/vertical/<industry>/`
- ✅ Weekly Merging Rebase sync from upstream (conflict-minimized)

**Sync Overhead**: ⬇️ LOW — Single fork, config-driven, ~80% code reuse across verticals.

---

## 1. System Architecture

### 1.1 Logical Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Aether SaaS                           │
│                   (Single Monorepo Fork)                     │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
         ┌──────────▼──────────┐  ┌──────────▼──────────┐
         │   Frontend Layer    │  │   Backend Layer    │
         │  (apps/web + UI)    │  │  (apps/api + core) │
         └──────────┬──────────┘  └──────────┬──────────┘
                    │                        │
        ┌───────────┴───────────┐  ┌────────┴────────┐
        │                       │  │                 │
   ┌────▼─────┐           ┌────▼──▼──┐         ┌────▼──────┐
   │   Tenant  │           │ Feature  │         │ Provider  │
   │  Feature  │           │   Flags  │         │ Registry  │
   │  Flags    │           │  System  │         │(Auth/LLM) │
   │(runtime)  │           │(DB+env)  │         │           │
   └────┬──────┘           └────┬─────┘         └────┬──────┘
        │                       │                    │
        └───────────┬───────────┴────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  Request Context    │
         │ (AsyncLocalStorage) │
         │  - tenantId         │
         │  - accountId        │
         │  - sandboxId        │
         │  - userId           │
         └──────────┬──────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
    ┌───▼────┐             ┌───▼────┐
    │Vertical│             │  DB    │
    │ Config │             │(Shared)│
    │Loaders │             │(RLS)   │
    └────────┘             └────────┘
        │                       │
    ┌───▼──────────────────────▼──┐
    │ packages/vertical/<industry>/│
    │ - Prompts                    │
    │ - Schemas                    │
    │ - Workflows                  │
    │ - UI Components              │
    │ - Integrations               │
    └──────────────────────────────┘
```

### 1.2 Data Flow: Vertical Customization

```
User Request (tenant=finance, accountId=acme-1)
         │
         ▼
Auth Middleware
  ├─ Extract tenant/account from JWT
  ├─ setContextField('tenantId', 'finance')
  ├─ setContextField('accountId', 'acme-1')
         │
         ▼
Feature Flags Middleware
  ├─ Load tenant-scoped flags: getConfig('finance').features
  ├─ Check: isFeatureEnabled('finance', 'custom-billing')
  ├─ Set c.set('tenantFlags', flags)
         │
         ▼
Route Handler
  ├─ Read: getContextFields() → { tenantId, accountId, ... }
  ├─ Load: getConfig('finance') → { billing, providers, ui, ... }
  ├─ Execute: Vertical-specific business logic
  ├─ Query: DB query with WHERE accountId = 'acme-1' (RLS)
         │
         ▼
Response (tenant-customized)
```

### 1.3 Deployment Architecture

```
┌─────────────────────────────────────┐
│  Shared Infrastructure              │
│  - Docker Compose (LiteLLM, Redis) │
│  - PostgreSQL (single shared DB)    │
│  - Nginx Load Balancer              │
└─────────────────────────────────────┘
         │
         ▼
┌────────┴────────┬────────────────────┐
│                 │                    │
┌───▼──────┐  ┌──▼────────┐  ┌───────▼──┐
│ Web App  │  │ API       │  │ Agent    │
│(Next.js) │  │(Hono)     │  │(Aether)  │
│Instance  │  │Instance   │  │Instance  │
│(1)       │  │(1)        │  │(1)       │
└──────────┘  └───────────┘  └──────────┘
         │           │            │
         └─────┬─────┴────────────┘
               │
         ┌─────▼──────────┐
         │  PostgreSQL    │
         │  - accounts    │
         │  - accountRLS  │
         │  - feature_    │
         │    flags       │
         │  - vertical    │
         │    config      │
         └────────────────┘
```

**Note**: Single deployment per SaaS instance. Multi-tenancy enforced via:
- DB row-level security (existing accountId model)
- Request-scoped context (tenantId propagation)
- Feature flags (tenant-specific capabilities)

---

## 2. Database Schema (Multi-Tenant Model)

### 2.1 Existing Tables (Leveraged)

```sql
-- accounts (existing)
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name TEXT,
  slug TEXT UNIQUE,  -- e.g., "acme-corp", "finance-demo"
  createdAt TIMESTAMP,
  ...
);

-- accountMembers (existing)
CREATE TABLE accountMembers (
  id UUID PRIMARY KEY,
  accountId UUID REFERENCES accounts(id),
  userId UUID,
  role TEXT, -- 'admin', 'member', 'viewer'
  ...
);

-- sandboxes (existing)
CREATE TABLE sandboxes (
  id UUID PRIMARY KEY,
  accountId UUID REFERENCES accounts(id),
  name TEXT,
  ...
);
```

### 2.2 New Tables (Multi-Tenant Extensions)

```sql
-- feature_flags (NEW)
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  accountId UUID REFERENCES accounts(id),
  featureName TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',  -- Feature-specific settings
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(accountId, featureName)
);

-- vertical_config (NEW)
CREATE TABLE vertical_config (
  id UUID PRIMARY KEY,
  accountId UUID REFERENCES accounts(id),
  verticalId TEXT NOT NULL,  -- 'finance', 'healthcare', 'retail'
  config JSONB NOT NULL,  -- { billing, providers, ui, prompts, ... }
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(accountId, verticalId)
);

-- account_integrations (NEW)
CREATE TABLE account_integrations (
  id UUID PRIMARY KEY,
  accountId UUID REFERENCES accounts(id),
  integrationType TEXT NOT NULL,  -- 'stripe', 'okta', 'custom-llm'
  credentials JSONB NOT NULL ENCRYPTED,  -- Encrypted per-vertical secrets
  createdAt TIMESTAMP DEFAULT NOW(),
  ...
);
```

### 2.3 Row-Level Security (RLS) Policy

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE vertical_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own account's rows
CREATE POLICY tenant_isolation ON feature_flags
  USING (accountId = auth.jwt_claim('accountId'));

CREATE POLICY tenant_isolation ON vertical_config
  USING (accountId = auth.jwt_claim('accountId'));
```

---

## 3. Configuration Layer (Centralized)

### 3.1 Config Loader (`apps/api/src/lib/config-loader.ts` — NEW)

```typescript
// Purpose: Centralized tenant-scoped config resolver
// Replaces: Direct process.env reads throughout codebase

import type { VerticalId } from '@acme/types';

export interface VerticalConfig {
  verticalId: VerticalId;
  features: Record<string, boolean | object>;
  billing: {
    provider: 'stripe' | 'paddle' | 'custom';
    pricing: Record<string, number>;
    capacity: { tokens: number; requests: number };
  };
  providers: {
    llm: string[];  // e.g., ['gpt-4', 'claude-opus']
    auth: string;   // e.g., 'okta', 'auth0', 'supabase'
  };
  ui: {
    theme: string;  // 'finance' | 'healthcare' | 'retail'
    logoUrl: string;
    menuItems: string[];
  };
}

/**
 * Load config for a specific account/vertical
 * Priority: DB (feature_flags + vertical_config) > env > packages/vertical defaults
 */
export async function getConfig(accountId: string): Promise<VerticalConfig> {
  // 1. Fetch from DB
  const [verticalConfig, featureFlags] = await Promise.all([
    db.query.vertical_config.findFirst({
      where: eq(schema.vertical_config.accountId, accountId),
    }),
    db.query.feature_flags.findMany({
      where: eq(schema.feature_flags.accountId, accountId),
    }),
  ]);

  // 2. Merge with env overrides (process.env.VERTICAL_* for current instance)
  const verticalId = process.env.VERTICAL_ID || verticalConfig?.verticalId || 'default';

  // 3. Load defaults from packages/vertical/<verticalId>/config.ts
  const defaults = await import(`@acme/vertical-${verticalId}`).then(
    m => m.defaultConfig,
  );

  // 4. Merge priority: DB > env > defaults
  return {
    verticalId,
    features: {
      ...defaults.features,
      ...Object.fromEntries(
        featureFlags.map(f => [f.featureName, f.config || f.enabled]),
      ),
    },
    billing: verticalConfig?.config?.billing || defaults.billing,
    providers: verticalConfig?.config?.providers || defaults.providers,
    ui: verticalConfig?.config?.ui || defaults.ui,
  };
}

/**
 * Helper: Is feature enabled for account?
 */
export async function isFeatureEnabled(
  accountId: string,
  featureName: string,
): Promise<boolean> {
  const config = await getConfig(accountId);
  return config.features[featureName] === true;
}
```

### 3.2 Request Context Middleware (Extend Existing)

```typescript
// apps/api/src/middleware/tenant-context.ts (NEW)

import { getContextFields, setContextField } from '@acme/request-context';

/**
 * Extract tenant info from JWT and populate request context
 */
export async function tenantContextMiddleware(c: Context, next: Next) {
  const user = c.get('user');  // From auth middleware
  const tenantId = c.req.query('tenant') || user?.defaultTenant;
  const accountId = user?.accountId;

  if (!accountId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Populate context for all downstream code
  setContextField('tenantId', tenantId);
  setContextField('accountId', accountId);
  setContextField('userId', user.id);
  setContextField('sandboxId', user?.defaultSandbox);

  // Load config for this tenant early
  const config = await getConfig(accountId);
  setContextField('config', config);

  return next();
}

app.use('*', tenantContextMiddleware);
```

### 3.3 Frontend Config Injection (`apps/web/src/lib/env-config.ts` — Extend)

```typescript
// Support runtime config override for multi-tenant SaaS
// If running single Aether instance serving multiple customers,
// `window.__AETHER_CONFIG__` is injected by server at request time

export function getPublicConfig() {
  if (typeof window !== 'undefined' && window.__AETHER_CONFIG__) {
    return window.__AETHER_CONFIG__;
  }
  // Fallback to build-time env vars
  return {
    verticalId: process.env.NEXT_PUBLIC_VERTICAL_ID,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    // ...
  };
}
```

---

## 4. Vertical Scaffolding

### 4.1 Directory Structure

```
packages/vertical/
├── finance/
│   ├── src/
│   │   ├── config.ts          # Default config for finance vertical
│   │   ├── prompts/           # Industry-specific agent prompts
│   │   │   ├── compliance.prompt
│   │   │   ├── reconciliation.prompt
│   │   │   └── audit.prompt
│   │   ├── schemas/           # Industry-specific data schemas
│   │   │   ├── transaction.ts
│   │   │   ├── account.ts
│   │   │   └── compliance-rule.ts
│   │   ├── workflows/         # Industry-specific task workflows
│   │   │   ├── bank-rec.ts
│   │   │   ├── close.ts
│   │   │   └── audit-prep.ts
│   │   ├── integrations/      # Industry-specific provider integrations
│   │   │   ├── stripe.ts
│   │   │   ├── plaid.ts
│   │   │   └── xero.ts
│   │   ├── ui-components/     # Finance-specific UI extensions
│   │   │   ├── FinanceDashboard.tsx
│   │   │   ├── TransactionList.tsx
│   │   │   └── ComplianceAudit.tsx
│   │   ├── hooks/             # Finance-specific React hooks
│   │   │   ├── useFinancialData.ts
│   │   │   └── useCompliance.ts
│   │   └── index.ts           # Re-exports
│   ├── package.json
│   └── tsconfig.json
├── healthcare/
│   ├── src/
│   │   ├── config.ts
│   │   ├── prompts/           # EMR/CDSS prompts
│   │   ├── schemas/           # Patient, encounter, prescription
│   │   ├── workflows/         # Clinical workflows
│   │   ├── integrations/      # EHR APIs, pharmacy integrations
│   │   ├── ui-components/     # Healthcare-specific UI
│   │   └── ...
│   ├── package.json
│   └── tsconfig.json
└── retail/
    ├── src/
    │   ├── config.ts
    │   ├── prompts/           # Inventory, POS, supply chain
    │   ├── schemas/
    │   ├── workflows/
    │   ├── integrations/
    │   ├── ui-components/
    │   └── ...
    ├── package.json
    └── tsconfig.json
```

### 4.2 Vertical Config Template

```typescript
// packages/vertical/finance/src/config.ts

import type { VerticalConfig } from '@acme/config';

export const defaultConfig: VerticalConfig = {
  verticalId: 'finance',
  features: {
    customBilling: false,
    advancedCompliance: true,
    auditTrail: true,
    bankReconciliation: true,
  },
  billing: {
    provider: 'stripe',
    pricing: {
      starter: 99,
      professional: 299,
      enterprise: 999,
    },
    capacity: {
      tokens: 1_000_000,
      requests: 50_000,
    },
  },
  providers: {
    llm: ['gpt-4', 'claude-opus'],
    auth: 'supabase',
  },
  ui: {
    theme: 'finance',
    logoUrl: '/logos/aether-finance.svg',
    menuItems: [
      'dashboard',
      'transactions',
      'reconciliation',
      'compliance',
      'reporting',
    ],
  },
};

// Export vertical-specific exports
export { compliance, reconciliation, auditPrep } from './workflows';
export * as FinanceComponents from './ui-components';
export * as FinanceSchemas from './schemas';
```

---

## 5. Feature Flags System

### 5.1 Feature Flag Definitions

```typescript
// apps/api/src/config/feature-flags.ts (NEW)

export const FeatureFlagDefs = {
  // Finance vertical
  'finance:advanced-compliance': {
    description: 'Enable advanced compliance checks (SOX, GDPR)',
    defaultValue: false,
    rolloutPercentage: 0,
  },
  'finance:bank-reconciliation': {
    description: 'Enable automated bank reconciliation',
    defaultValue: true,
    rolloutPercentage: 100,
  },

  // Healthcare vertical
  'healthcare:cdss': {
    description: 'Enable Clinical Decision Support System',
    defaultValue: false,
    rolloutPercentage: 50,  // Gradual rollout
  },
  'healthcare:phi-encryption': {
    description: 'Enable PHI encryption at rest',
    defaultValue: true,
    rolloutPercentage: 100,
  },

  // Retail vertical
  'retail:inventory-forecasting': {
    description: 'Enable AI-powered inventory forecasting',
    defaultValue: false,
    rolloutPercentage: 25,
  },
};
```

### 5.2 Feature Flag Middleware

```typescript
// apps/api/src/middleware/feature-flags.ts (EXTEND)

export async function featureFlagsMiddleware(c: Context, next: Next) {
  const { accountId, tenantId } = getContextFields();

  // Fetch all flags for this account
  const flags = await db.query.feature_flags.findMany({
    where: eq(schema.feature_flags.accountId, accountId),
  });

  // Build flag map: tenantId:flagName → enabled
  const flagMap = new Map(
    flags.map(f => [`${tenantId}:${f.featureName}`, f.enabled]),
  );

  // Helper: Check if flag is enabled
  c.set('isFeatureEnabled', (flagName: string) => {
    return flagMap.get(`${tenantId}:${flagName}`) ?? false;
  });

  return next();
}

app.use('*', featureFlagsMiddleware);
```

### 5.3 Frontend Feature Flags

```typescript
// apps/web/src/lib/feature-flags.ts (EXTEND)

export function useFeatureFlag(flagName: string): boolean {
  const { accountId } = useUser();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch(`/api/feature-flag/${flagName}?accountId=${accountId}`)
      .then(r => r.json())
      .then(d => setEnabled(d.enabled));
  }, [flagName, accountId]);

  return enabled;
}

// Usage in component:
function ComplianceAudit() {
  const advancedCompliance = useFeatureFlag('finance:advanced-compliance');

  if (!advancedCompliance) {
    return <p>Feature not available for your account</p>;
  }

  return <AdvancedComplianceUI />;
}
```

---

## 6. API Endpoints (Vertical-Scoped)

### 6.1 Vertical Config Endpoints

```typescript
// apps/api/src/routes/verticals.ts (NEW)

// GET /api/verticals/:verticalId/config
// Returns config for a specific vertical (tenant-scoped)
router.get('/api/verticals/:verticalId/config', async (c) => {
  const { accountId } = getContextFields();
  const config = await getConfig(accountId);
  return c.json(config);
});

// PUT /api/verticals/:verticalId/config
// Update vertical config for account
router.put('/api/verticals/:verticalId/config', async (c) => {
  const { accountId } = getContextFields();
  const updates = await c.req.json();
  
  await db
    .update(schema.vertical_config)
    .set({ config: updates })
    .where(
      and(
        eq(schema.vertical_config.accountId, accountId),
        eq(schema.vertical_config.verticalId, c.param('verticalId')),
      ),
    );

  return c.json({ success: true });
});

// GET /api/feature-flags
// List all feature flags for account
router.get('/api/feature-flags', async (c) => {
  const { accountId } = getContextFields();
  const flags = await db.query.feature_flags.findMany({
    where: eq(schema.feature_flags.accountId, accountId),
  });
  return c.json(flags);
});

// POST /api/feature-flags/:flagName/toggle
// Toggle a feature flag
router.post('/api/feature-flags/:flagName/toggle', async (c) => {
  const { accountId } = getContextFields();
  const flagName = c.param('flagName');
  
  const existing = await db.query.feature_flags.findFirst({
    where: and(
      eq(schema.feature_flags.accountId, accountId),
      eq(schema.feature_flags.featureName, flagName),
    ),
  });

  if (existing) {
    await db
      .update(schema.feature_flags)
      .set({ enabled: !existing.enabled })
      .where(eq(schema.feature_flags.id, existing.id));
  } else {
    await db.insert(schema.feature_flags).values({
      accountId,
      featureName: flagName,
      enabled: true,
    });
  }

  return c.json({ success: true });
});
```

---

## 7. Menu & Command Registry (Vertical-Scoped)

### 7.1 Dynamic Menu Registry

```typescript
// apps/web/src/lib/menu-registry.ts (EXTEND for multi-tenant)

export interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
  verticalId?: string;  // Scope to specific vertical
  requiredFeatureFlag?: string;
}

export const menuRegistry: MenuGroup[] = [
  // Shared (all verticals)
  {
    id: 'core',
    label: 'Core',
    items: [
      { id: 'home', label: 'Dashboard', icon: 'home' },
      { id: 'settings', label: 'Settings', icon: 'settings' },
    ],
  },

  // Finance vertical
  {
    id: 'finance',
    label: 'Finance',
    verticalId: 'finance',
    items: [
      { id: 'transactions', label: 'Transactions', icon: 'receipt' },
      { id: 'reconciliation', label: 'Bank Reconciliation', icon: 'balance' },
      {
        id: 'compliance',
        label: 'Compliance',
        icon: 'shield',
        requiredFeatureFlag: 'finance:advanced-compliance',
      },
    ],
  },

  // Healthcare vertical
  {
    id: 'healthcare',
    label: 'Healthcare',
    verticalId: 'healthcare',
    items: [
      { id: 'patients', label: 'Patients', icon: 'users' },
      { id: 'encounters', label: 'Encounters', icon: 'calendar' },
      {
        id: 'cdss',
        label: 'Clinical Decision Support',
        icon: 'brain',
        requiredFeatureFlag: 'healthcare:cdss',
      },
    ],
  },

  // Retail vertical
  {
    id: 'retail',
    label: 'Retail',
    verticalId: 'retail',
    items: [
      { id: 'inventory', label: 'Inventory', icon: 'box' },
      { id: 'pos', label: 'Point of Sale', icon: 'shopping-cart' },
      {
        id: 'forecasting',
        label: 'Demand Forecasting',
        icon: 'trending-up',
        requiredFeatureFlag: 'retail:inventory-forecasting',
      },
    ],
  },
];

/**
 * Get menu items for current user's vertical + enabled flags
 */
export function getVisibleMenu(verticalId: string, enabledFlags: string[]): MenuGroup[] {
  return menuRegistry
    .filter(group => !group.verticalId || group.verticalId === verticalId)
    .map(group => ({
      ...group,
      items: group.items.filter(
        item => !item.requiredFeatureFlag || enabledFlags.includes(item.requiredFeatureFlag),
      ),
    }));
}
```

---

## 8. Error Handling & Isolation

### 8.1 Tenant Isolation Errors

```typescript
// apps/api/src/lib/errors.ts (EXTEND)

export class TenantMismatchError extends Error {
  constructor(accountId: string, requestedAccountId: string) {
    super(
      `Tenant mismatch: ${accountId} !== ${requestedAccountId}. Access denied.`,
    );
    this.name = 'TenantMismatchError';
  }
}

export class VerticalNotFoundError extends Error {
  constructor(verticalId: string, accountId: string) {
    super(
      `Vertical ${verticalId} not configured for account ${accountId}.`,
    );
    this.name = 'VerticalNotFoundError';
  }
}

export class FeatureFlagNotEnabledError extends Error {
  constructor(flagName: string, accountId: string) {
    super(
      `Feature ${flagName} is not enabled for account ${accountId}.`,
    );
    this.name = 'FeatureFlagNotEnabledError';
  }
}
```

### 8.2 Route Guards

```typescript
// Example: Protect compliance endpoints to finance vertical + feature flag

router.post('/api/finance/compliance/check', async (c) => {
  const { accountId, tenantId } = getContextFields();

  // Guard 1: Tenant must be 'finance'
  if (tenantId !== 'finance') {
    throw new VerticalNotFoundError(tenantId, accountId);
  }

  // Guard 2: Feature flag must be enabled
  const flagEnabled = c.get('isFeatureEnabled')('finance:advanced-compliance');
  if (!flagEnabled) {
    throw new FeatureFlagNotEnabledError(
      'finance:advanced-compliance',
      accountId,
    );
  }

  // Safe to proceed with compliance logic
  return c.json(await runComplianceCheck(accountId));
});
```

---

## 9. Security & Isolation Guarantees

### 9.1 Request Context Isolation

- ✅ **AsyncLocalStorage** ensures tenant context is scoped to request handler
- ✅ No global state pollution between concurrent requests
- ✅ All downstream code calls `getContextFields()` to access tenant info
- ✅ No way for context to leak across tenants

### 9.2 Database Row-Level Security

- ✅ All queries must filter by `accountId` (enforced at schema level)
- ✅ RLS policies block SELECT/UPDATE/DELETE without matching accountId
- ✅ Even compromised app code cannot query cross-tenant data

### 9.3 Feature Flag Enforcement

- ✅ Sensitive features gated by flags + middleware checks
- ✅ Frontend feature flags prevent UI rendering
- ✅ Backend route guards prevent API access
- ✅ Gradual rollout possible (e.g., 50% of accounts get CDSS)

### 9.4 API Key Isolation

- ✅ Provider credentials stored encrypted in `account_integrations` table
- ✅ Scoped to specific accountId
- ✅ Decrypted only when needed, in-memory only

---

## 10. Testing Strategy

### 10.1 Unit Tests (Per-Vertical)

```typescript
// packages/vertical/finance/__tests__/reconciliation.test.ts

describe('Finance: Bank Reconciliation', () => {
  it('should reconcile transactions with bank statement', async () => {
    const accountId = 'test-acme-finance';
    const transactions = [
      { id: '1', amount: 100, date: '2025-01-01' },
      { id: '2', amount: 200, date: '2025-01-02' },
    ];

    const result = await reconcileTransactions(accountId, transactions);
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toHaveLength(0);
  });
});
```

### 10.2 Integration Tests (Multi-Tenant)

```typescript
// apps/api/__tests__/multi-tenant.test.ts

describe('Multi-Tenant Isolation', () => {
  it('should not leak finance data to healthcare tenant', async () => {
    // Create two tenants
    const finance = await createTestAccount('finance-demo');
    const healthcare = await createTestAccount('healthcare-demo');

    // Insert finance transaction
    await db.insert(schema.transactions).values({
      accountId: finance.id,
      amount: 1000,
    });

    // Query as healthcare tenant
    const ctx = setContextField('accountId', healthcare.id);
    const results = await queryTransactions();

    expect(results).toHaveLength(0);  // Should see nothing
  });

  it('should enable feature flags independently per tenant', async () => {
    const finance = await createTestAccount('finance-demo');
    const healthcare = await createTestAccount('healthcare-demo');

    // Enable advanced compliance for finance only
    await enableFeatureFlag(finance.id, 'advanced-compliance');

    // Check as finance tenant
    expect(await isFeatureEnabled(finance.id, 'advanced-compliance')).toBe(true);

    // Check as healthcare tenant
    expect(await isFeatureEnabled(healthcare.id, 'advanced-compliance')).toBe(
      false,
    );
  });
});
```

### 10.3 E2E Tests (Vertical Workflows)

```typescript
// apps/web/e2e/finance-reconciliation.e2e.ts

describe('Finance: Bank Reconciliation Workflow', () => {
  it('should complete full reconciliation flow', async ({ page }) => {
    // Log in as finance user
    await loginAs(page, 'finance-user@acme.com');

    // Navigate to reconciliation
    await page.click('text=Reconciliation');

    // Upload bank statement
    await page.setInputFiles('input[type="file"]', 'test-statement.csv');

    // Verify transactions matched
    await expect(page.locator('text=2 matched')).toBeVisible();

    // Approve reconciliation
    await page.click('button:has-text("Approve")');

    // Verify success
    await expect(page.locator('text=Reconciliation complete')).toBeVisible();
  });
});
```

---

## 11. Upstream Sync Strategy (Weekly Merging Rebase)

### 11.1 Sync Workflow

```bash
# 1. Fetch latest from upstream (aimentor606/aether)
git fetch upstream main

# 2. Rebase our changes onto upstream/main
git rebase upstream/main

# 3. If conflicts (expected in config, schema, plugin files):
#    - packages/db/drizzle/* → keep ours (vertical schema)
#    - packages/vertical/* → keep ours (industry config)
#    - core/aether-master/opencode/* → merge carefully
#    - Everything else → take upstream

# 4. Resolve, continue rebase
git add <resolved-files>
git rebase --continue

# 5. Force push to our fork (only if rebasing, not merging)
git push origin main --force-with-lease

# 6. Test full suite
npm run test
npm run build
```

### 11.2 Merge Conflict Reduction

**High-Risk Files** (expect conflicts):
- `packages/db/drizzle/migrations/*` — Always keep ours (vertical additions)
- `packages/vertical/*` — Always keep ours (our industry config)
- `core/aether-master/opencode/*` — Careful review; may need manual merge

**Low-Risk Files** (rarely conflict):
- `apps/web/src/pages/*` — Upstream rarely changes this
- `apps/api/src/routes/*` — We extend, they don't clobber
- `.env.example` — Upstream updates; we keep both + document

**Best Practice**:
- Rebase weekly (small conflict batches)
- Never rebase from random branch; always from upstream/main
- Document all custom changes (comments in code: `// CUSTOM: vertical-specific`)

---

## 12. Constraints & Limitations

### 12.1 Known Constraints

1. **No Per-Vertical DB Schema** (by design)
   - All verticals share same schema; extend via JSONB columns
   - Benefit: Simple migrations, no cross-tenant schema issues
   - Limitation: Some industry-specific columns must use JSONB

2. **Single Deployment Instance** (by design)
   - One Backend API, one Frontend, one DB
   - Benefit: Simpler ops, easier to manage
   - Limitation: All verticals must scale together (can add Read Replicas per vertical if needed)

3. **Feature Flag Overhead** (acceptable)
   - Every request checks flags; ~5-10ms per flag lookup
   - Benefit: Fine-grained control, gradual rollouts
   - Mitigation: Cache flags in-memory, invalidate on update

4. **OpenCode Plugin Customization Limited** (acceptable for MVP)
   - Plugins work at agent level; not UI components
   - Benefit: Clean separation, backward compatible
   - Future: Enhance plugin system for UI-level customization (Phase 2)

### 12.2 Out of Scope (For Future)

- ❌ Mobile app customization (per user constraint: "exclude mobile for now")
- ❌ Per-vertical deployment (single SaaS instance per design)
- ❌ Custom database schema per vertical (too much migration overhead)
- ❌ Dynamic feature flag UI admin panel (Phase 2 enhancement)

---

## 13. Implementation Roadmap (High-Level)

| Phase | Duration | Key Milestones |
|-------|----------|-----------------|
| **Phase 1: Scaffolding** | 1 week | Fork setup, monorepo structure, config layer |
| **Phase 2: Core Infrastructure** | 1 week | Request context, feature flags, menu registry |
| **Phase 3: Vertical Templates** | 1 week | Finance, Healthcare, Retail stubs + schemas |
| **Phase 4: Feature Development** | 4-6 weeks | Per-vertical business logic (concurrent teams) |
| **Phase 5: Testing & QA** | 1 week | E2E tests, cross-tenant isolation verification |
| **Phase 6: Deployment & Monitoring** | 1 week | LiteLLM + SaaS deployment, observability |
| **Phase 7: Go-Live** | Ongoing | Gradual rollout via feature flags |

---

## 14. Success Criteria

✅ **Functional**:
- [ ] Single codebase serves 3+ verticals with independent config
- [ ] Feature flags enable/disable per-vertical capabilities
- [ ] Multi-tenant isolation verified (no data leaks)
- [ ] Upstream sync runs weekly with <5 conflicts/merge

✅ **Operational**:
- [ ] Deployment time: <10 minutes (Docker Compose)
- [ ] Request latency: <200ms P99 (with flag cache)
- [ ] SLA: 99.5% uptime (shared infra)

✅ **Developer Experience**:
- [ ] New vertical onboarding: <2 hours
- [ ] Adding feature flag: <15 minutes (CLI tool or admin UI)
- [ ] Debugging tenant issue: Traceable via request context logs

---

## 15. Next Steps (Approval Gate)

**Before Implementation**:
1. ✅ Review architecture design (this doc)
2. ⏳ User approval: "This approach resonates. Proceed."
3. ⏳ Engineering review: "Architecture is sound. Ready to code."
4. ⏳ Security review: "Isolation guarantees are sufficient for MVP."

**After Approval**:
1. Generate detailed **Implementation Plan** (week-by-week breakdown)
2. Create **git branching strategy** (which branches for which work)
3. Begin **Phase 1: Scaffolding** (fork setup, config layer)

---

## Appendix A: Config Example

```yaml
# Example: Finance vertical config
# (What gets stored in vertical_config table)

verticalId: finance
features:
  customBilling: false
  advancedCompliance: true
  auditTrail: true
  bankReconciliation: true
billing:
  provider: stripe
  pricing:
    starter: 99
    professional: 299
    enterprise: 999
  capacity:
    tokens: 1000000
    requests: 50000
providers:
  llm:
    - gpt-4
    - claude-opus
  auth: supabase
ui:
  theme: finance
  logoUrl: /logos/aether-finance.svg
  menuItems:
    - dashboard
    - transactions
    - reconciliation
    - compliance
    - reporting
prompts:
  reconciliation: |
    You are a bank reconciliation expert...
  compliance: |
    You are a compliance auditor...
integrations:
  stripe:
    publicKey: pk_live_xxx
    webhookSecret: whsec_xxx
  plaid:
    clientId: xxx
    environment: production
```

---

**Document Status**: ✅ READY FOR REVIEW

**Next**: Await user approval. Upon approval, proceed with detailed Implementation Plan (week-by-week with concrete code changes).
