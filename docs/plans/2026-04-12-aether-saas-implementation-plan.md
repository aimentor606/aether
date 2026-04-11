# Aether SaaS Implementation Plan
**Date**: April 12, 2026  
**Approach**: Single Codebase Multi-Tenant (Approach 1)  
**Status**: Ready for Execution  
**Duration**: 8-10 weeks (7 phases, concurrent from Phase 3 onward)

---

## Overview

This plan breaks Approach 1 (Single Codebase Multi-Tenant) into 7 executable phases with concrete file edits, git strategy, and rollout sequence. Each phase includes acceptance criteria, risk mitigations, and team assignments.

**Assumptions**:
- Upstream kortix-ai/suna synced weekly via Merging Rebase
- Verticals: finance, healthcare, retail (MVP)
- Database: Shared Supabase instance with RLS policies
- Deployment: Single SaaS instance (multi-tenant via middleware + config)
- Team: Single or small team; sequential phases or parallelizable components

---

## Phase Timeline

| Phase | Duration | Focus | Owner | Dependencies |
|-------|----------|-------|-------|--------------|
| Phase 1 | Week 1 | Scaffolding | DevOps/Backend | None |
| Phase 2 | Week 1-2 | Core Infrastructure | Backend | Phase 1 |
| Phase 3 | Week 2-3 | Vertical Templates | Full Team | Phase 1, Phase 2 |
| Phase 4 | Week 3-5 | Feature Development (Parallel) | Feature Leads | Phase 3 |
| Phase 5 | Week 5-6 | Testing & QA | QA Lead | Phase 4 |
| Phase 6 | Week 6-7 | Deployment Pipeline | DevOps | Phase 2, Phase 5 |
| Phase 7 | Week 7-8+ | Go-Live & Rollout | Product + DevOps | All prior phases |

---

## Phase 1: Scaffolding & Foundation (Week 1)

### Objective
Set up monorepo structure, fork strategy, and core configuration layer foundation.

### Deliverables

#### 1.1 Fork Strategy Setup
**File**: `.github/workflows/sync-upstream.yml` (NEW)
```yaml
name: Sync Upstream (Merging Rebase)
on:
  schedule:
    - cron: '0 2 * * 1'  # Weekly Monday 2 AM UTC
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - run: |
          git remote add upstream https://github.com/kortix-ai/suna.git
          git fetch upstream main
          git rebase -i upstream/main --autosquash
          git push origin main --force-with-lease
```

**File**: `FORK_MAINTENANCE.md` (NEW)
- Document Merging Rebase workflow
- High-risk files for merge conflicts (12 identified from Phase 0)
- Conflict resolution playbook
- Weekly sync checklist

#### 1.2 Vertical Packages Scaffolding
Create directory structure for vertical customization:

**Directory**: `packages/vertical/finance/` (NEW)
```
packages/vertical/finance/
├── package.json
├── tsconfig.json
├── config.ts              # Finance-specific config (billing, providers, features)
├── src/
│   ├── prompts/           # Finance-specific AI prompts
│   ├── schemas/           # Finance-specific data schemas
│   ├── workflows/         # Finance-specific workflows
│   ├── integrations/      # Finance integrations (Stripe, QuickBooks, etc.)
│   ├── components/        # Finance UI components
│   └── index.ts           # Export public API
├── __tests__/
│   ├── config.test.ts
│   └── integration.test.ts
└── README.md
```

**Same structure for**:
- `packages/vertical/healthcare/`
- `packages/vertical/retail/`

**File**: `packages/vertical/finance/package.json`
```json
{
  "name": "@acme/vertical-finance",
  "version": "1.0.0",
  "main": "src/index.ts",
  "dependencies": {
    "@acme/shared": "workspace:*",
    "@acme/db": "workspace:*"
  }
}
```

**File**: `packages/vertical/finance/config.ts` (NEW)
```typescript
export interface FinanceConfig {
  billing: {
    provider: 'stripe' | 'custom';
    features: string[];
  };
  integrations: {
    quickbooks: boolean;
    xero: boolean;
    sage: boolean;
  };
  ui: {
    theme: 'dark' | 'light';
    logoUrl: string;
  };
  prompts: {
    systemPrompt: string;
    invoiceTemplate: string;
  };
}

export const defaultConfig: FinanceConfig = {
  billing: {
    provider: 'stripe',
    features: ['invoicing', 'expense-tracking', 'basic-reporting'],
  },
  integrations: {
    quickbooks: true,
    xero: false,
    sage: false,
  },
  ui: {
    theme: 'light',
    logoUrl: 'https://cdn.acme.com/finance-logo.png',
  },
  prompts: {
    systemPrompt: 'You are a financial assistant...',
    invoiceTemplate: '<!-- template -->',
  },
};
```

#### 1.3 Root Monorepo Config Updates
**File**: `pnpm-workspace.yaml` (EDIT)
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'core/*'
  - 'packages/vertical/*'          # NEW
```

**File**: `tsconfig.base.json` (EDIT)
Add path aliases:
```json
{
  "compilerOptions": {
    "paths": {
      "@acme/vertical-finance": ["packages/vertical/finance/src"],
      "@acme/vertical-healthcare": ["packages/vertical/healthcare/src"],
      "@acme/vertical-retail": ["packages/vertical/retail/src"],
      "@acme/vertical": ["packages/vertical/*/src"]
    }
  }
}
```

**File**: `package.json` (EDIT - root)
```json
{
  "scripts": {
    "dev": "turbo run dev --parallel",
    "dev:web": "turbo run dev --filter=@acme/web",
    "dev:api": "turbo run dev --filter=@acme/api",
    "build": "turbo run build",
    "build:verticals": "turbo run build --filter='@acme/vertical-*'",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:verticals": "turbo run test --filter='@acme/vertical-*'"
  }
}
```

#### 1.4 Database Schema: New Tables
**File**: `packages/db/src/schema/vertical.ts` (NEW)

```typescript
import { pgTable, text, jsonb, boolean, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './account';
import { relations } from 'drizzle-orm';

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull().references(() => accounts.id),
    verticalId: text('vertical_id').notNull(), // 'finance', 'healthcare', etc.
    featureName: text('feature_name').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    config: jsonb('config').default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    uniqueFeature: ['accountId', 'verticalId', 'featureName'],
  })
);

export const verticalConfigs = pgTable(
  'vertical_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull().references(() => accounts.id),
    verticalId: text('vertical_id').notNull(), // 'finance', 'healthcare', etc.
    config: jsonb('config').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }
);

export const accountIntegrations = pgTable(
  'account_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id').notNull().references(() => accounts.id),
    integrationType: text('integration_type').notNull(), // 'stripe', 'quickbooks', etc.
    credentials: jsonb('credentials').notNull(), // Encrypted in practice
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  }
);

// Relations
export const accountFlagsRelation = relations(featureFlags, ({ one }) => ({
  account: one(accounts, { fields: [featureFlags.accountId], references: [accounts.id] }),
}));

export const accountConfigsRelation = relations(verticalConfigs, ({ one }) => ({
  account: one(accounts, { fields: [verticalConfigs.accountId], references: [accounts.id] }),
}));
```

**File**: `packages/db/drizzle/migrations/001_add_vertical_tables.sql` (NEW)
```sql
-- Feature Flags Table
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  vertical_id TEXT NOT NULL,
  feature_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, vertical_id, feature_name)
);

-- Vertical Configs Table
CREATE TABLE vertical_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  vertical_id TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(account_id, vertical_id)
);

-- Account Integrations Table
CREATE TABLE account_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  credentials JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY feature_flags_isolation ON feature_flags
  USING (account_id = auth.uid() OR auth.has_role('admin'));

ALTER TABLE vertical_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY vertical_configs_isolation ON vertical_configs
  USING (account_id = auth.uid() OR auth.has_role('admin'));

ALTER TABLE account_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_integrations_isolation ON account_integrations
  USING (account_id = auth.uid() OR auth.has_role('admin'));

-- Indexes
CREATE INDEX idx_feature_flags_account ON feature_flags(account_id);
CREATE INDEX idx_vertical_configs_account ON vertical_configs(account_id);
CREATE INDEX idx_account_integrations_account ON account_integrations(account_id);
```

**Execute migration**:
```bash
pnpm run db:migrate
```

#### 1.5 Acceptance Criteria
- ✅ `packages/vertical/{finance,healthcare,retail}/` directories created with base structure
- ✅ `pnpm install` succeeds; no dependency conflicts
- ✅ `pnpm dev:verticals` builds all verticals
- ✅ Database migration runs cleanly; RLS policies applied
- ✅ Upstream sync workflow configured and tested (dry-run)
- ✅ Git feature branch: `feat/phase-1-scaffolding` created and tested

#### 1.6 Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| DB migration fails | Test on staging DB first; rollback plan documented |
| pnpm workspace conflicts | Lock file tested locally before commit |
| Upstream sync breaks branch | Test rebase on separate branch first; rollback tag prepared |

---

## Phase 2: Core Infrastructure (Week 1-2)

### Objective
Implement config loader, feature flags middleware, request context propagation, and API endpoints.

### Deliverables

#### 2.1 Config Loader Service
**File**: `apps/api/src/lib/config-loader.ts` (NEW)

```typescript
import { db } from '@acme/db';
import { eq, and } from 'drizzle-orm';
import { featureFlags, verticalConfigs } from '@acme/db/schema/vertical';

export interface TenantConfig {
  verticalId: string;
  accountId: string;
  features: Record<string, boolean>;
  billing?: Record<string, any>;
  integrations?: Record<string, any>;
  ui?: Record<string, any>;
  prompts?: Record<string, any>;
}

const configCache = new Map<string, { config: TenantConfig; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function getConfig(
  accountId: string,
  verticalId: string
): Promise<TenantConfig> {
  const cacheKey = `${accountId}:${verticalId}`;
  const cached = configCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.config;
  }

  // Load feature flags from DB
  const flagRecords = await db.query.featureFlags.findMany({
    where: and(
      eq(featureFlags.accountId, accountId),
      eq(featureFlags.verticalId, verticalId)
    ),
  });

  const featureFlagMap: Record<string, boolean> = {};
  flagRecords.forEach((flag) => {
    featureFlagMap[flag.featureName] = flag.enabled;
  });

  // Load vertical config from DB
  const verticalConfigRecord = await db.query.verticalConfigs.findFirst({
    where: and(
      eq(verticalConfigs.accountId, accountId),
      eq(verticalConfigs.verticalId, verticalId)
    ),
  });

  // Merge: DB config > vertical defaults > base defaults
  const verticalModule = await importVerticalModule(verticalId);
  const baseConfig = verticalModule.defaultConfig || {};
  const dbConfig = verticalConfigRecord?.config || {};

  const mergedConfig: TenantConfig = {
    verticalId,
    accountId,
    features: featureFlagMap,
    ...baseConfig,
    ...dbConfig,
  };

  // Cache result
  configCache.set(cacheKey, {
    config: mergedConfig,
    expiry: Date.now() + CACHE_TTL_MS,
  });

  return mergedConfig;
}

export async function invalidateConfigCache(
  accountId: string,
  verticalId: string
): Promise<void> {
  const cacheKey = `${accountId}:${verticalId}`;
  configCache.delete(cacheKey);
}

async function importVerticalModule(verticalId: string): Promise<any> {
  // Dynamically import vertical module based on verticalId
  // In practice, use dynamic imports or a registry pattern
  const modules: Record<string, any> = {
    finance: () => import('@acme/vertical-finance'),
    healthcare: () => import('@acme/vertical-healthcare'),
    retail: () => import('@acme/vertical-retail'),
  };

  const moduleLoader = modules[verticalId];
  if (!moduleLoader) {
    throw new Error(`Unknown vertical: ${verticalId}`);
  }

  return moduleLoader();
}

export function clearAllCaches(): void {
  configCache.clear();
}
```

#### 2.2 Request Context Middleware Extension
**File**: `apps/api/src/middleware/tenant-context.ts` (NEW)

```typescript
import { Context, Next } from 'hono';
import { getContextField, setContextField } from '@acme/request-context';
import { getConfig } from '../lib/config-loader';
import { jwtDecode } from 'jwt-decode';

export interface TenantContext {
  tenantId: string;
  verticalId: string;
  accountId: string;
  userId: string;
  sandboxId?: string;
  config?: any;
}

export async function tenantContextMiddleware(c: Context, next: Next) {
  // Extract JWT and decode to get user info
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.text('Unauthorized', 401);
  }

  const token = authHeader.substring(7);
  let decoded: any;

  try {
    decoded = jwtDecode(token);
  } catch (error) {
    return c.text('Invalid token', 401);
  }

  const userId = decoded.sub;
  const accountId = decoded.account_id;
  const verticalId = decoded.vertical_id || process.env.VERTICAL_ID || 'finance';

  // Set context fields for request scope
  setContextField('userId', userId);
  setContextField('accountId', accountId);
  setContextField('verticalId', verticalId);
  setContextField('tenantId', verticalId); // Tenant = vertical in this model

  // Load tenant config
  try {
    const config = await getConfig(accountId, verticalId);
    setContextField('config', config);
  } catch (error) {
    console.error(`Failed to load config for tenant ${verticalId}:`, error);
    return c.text('Config load failed', 500);
  }

  // Propagate to request context for downstream use
  c.set('tenantContext', {
    tenantId: verticalId,
    verticalId,
    accountId,
    userId,
    config: getContextField('config'),
  } as TenantContext);

  return next();
}

export function getTenantContext(c: Context): TenantContext {
  return c.get('tenantContext');
}
```

**File**: `apps/api/src/index.ts` (EDIT - register middleware)
```typescript
// Add to app initialization
app.use(tenantContextMiddleware);
```

#### 2.3 Feature Flags Service
**File**: `apps/api/src/lib/feature-flags.ts` (EDIT/EXTEND)

```typescript
import { db } from '@acme/db';
import { eq, and } from 'drizzle-orm';
import { featureFlags } from '@acme/db/schema/vertical';
import { getContextField } from '@acme/request-context';

export async function isFeatureEnabled(
  featureName: string,
  accountId?: string,
  verticalId?: string
): Promise<boolean> {
  // Default to request context if not provided
  const ctxAccountId = accountId || getContextField('accountId');
  const ctxVerticalId = verticalId || getContextField('verticalId');

  if (!ctxAccountId || !ctxVerticalId) {
    return false;
  }

  const flag = await db.query.featureFlags.findFirst({
    where: and(
      eq(featureFlags.accountId, ctxAccountId),
      eq(featureFlags.verticalId, ctxVerticalId),
      eq(featureFlags.featureName, featureName)
    ),
  });

  return flag?.enabled ?? false;
}

export async function toggleFeatureFlag(
  accountId: string,
  verticalId: string,
  featureName: string,
  enabled: boolean
): Promise<void> {
  // Upsert feature flag
  const existing = await db.query.featureFlags.findFirst({
    where: and(
      eq(featureFlags.accountId, accountId),
      eq(featureFlags.verticalId, verticalId),
      eq(featureFlags.featureName, featureName)
    ),
  });

  if (existing) {
    await db
      .update(featureFlags)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(featureFlags.id, existing.id));
  } else {
    await db.insert(featureFlags).values({
      accountId,
      verticalId,
      featureName,
      enabled,
    });
  }
}

export async function getFeatureFlags(
  accountId: string,
  verticalId: string
): Promise<Record<string, boolean>> {
  const flags = await db.query.featureFlags.findMany({
    where: and(
      eq(featureFlags.accountId, accountId),
      eq(featureFlags.verticalId, verticalId)
    ),
  });

  const result: Record<string, boolean> = {};
  flags.forEach((flag) => {
    result[flag.featureName] = flag.enabled;
  });

  return result;
}
```

#### 2.4 API Endpoints for Config Management
**File**: `apps/api/src/routes/verticals.ts` (NEW)

```typescript
import { Hono } from 'hono';
import { getTenantContext } from '../middleware/tenant-context';
import {
  isFeatureEnabled,
  toggleFeatureFlag,
  getFeatureFlags,
} from '../lib/feature-flags';
import { getConfig, invalidateConfigCache } from '../lib/config-loader';
import { db } from '@acme/db';
import { eq, and } from 'drizzle-orm';
import { verticalConfigs } from '@acme/db/schema/vertical';

const verticalRoutes = new Hono();

// GET /api/verticals/config — Get current tenant config
verticalRoutes.get('/config', async (c) => {
  const { tenantId, accountId, config } = getTenantContext(c);

  return c.json({
    verticalId: tenantId,
    accountId,
    config,
  });
});

// GET /api/verticals/features — List all feature flags for tenant
verticalRoutes.get('/features', async (c) => {
  const { accountId, verticalId } = getTenantContext(c);

  const flags = await getFeatureFlags(accountId, verticalId);

  return c.json({ features: flags });
});

// POST /api/verticals/features/:featureName/toggle — Toggle a feature flag
verticalRoutes.post('/features/:featureName/toggle', async (c) => {
  const { accountId, verticalId } = getTenantContext(c);
  const { featureName } = c.req.param();
  const { enabled } = await c.req.json();

  // Authorization: only admins can toggle flags
  const isAdmin = c.req.header('X-Admin-Token') === process.env.ADMIN_TOKEN;
  if (!isAdmin) {
    return c.text('Forbidden', 403);
  }

  await toggleFeatureFlag(accountId, verticalId, featureName, enabled);
  await invalidateConfigCache(accountId, verticalId);

  return c.json({ success: true, featureName, enabled });
});

// PUT /api/verticals/config — Update tenant config
verticalRoutes.put('/config', async (c) => {
  const { accountId, verticalId } = getTenantContext(c);
  const newConfig = await c.req.json();

  // Authorization: only admins can update config
  const isAdmin = c.req.header('X-Admin-Token') === process.env.ADMIN_TOKEN;
  if (!isAdmin) {
    return c.text('Forbidden', 403);
  }

  // Upsert vertical config
  const existing = await db.query.verticalConfigs.findFirst({
    where: and(
      eq(verticalConfigs.accountId, accountId),
      eq(verticalConfigs.verticalId, verticalId)
    ),
  });

  if (existing) {
    await db
      .update(verticalConfigs)
      .set({ config: newConfig, updatedAt: new Date() })
      .where(eq(verticalConfigs.id, existing.id));
  } else {
    await db.insert(verticalConfigs).values({
      accountId,
      verticalId,
      config: newConfig,
    });
  }

  await invalidateConfigCache(accountId, verticalId);

  return c.json({ success: true, config: newConfig });
});

export default verticalRoutes;
```

**File**: `apps/api/src/index.ts` (EDIT - register routes)
```typescript
import verticalRoutes from './routes/verticals';

// Register routes
app.route('/api/verticals', verticalRoutes);
```

#### 2.5 Frontend: Env Config & Feature Flags Extension
**File**: `apps/web/src/lib/env-config.ts` (EDIT/EXTEND)

```typescript
// Extend to support vertical-scoped runtime config
export interface VerticalRuntimeConfig {
  verticalId: string;
  accountId: string;
  features: Record<string, boolean>;
  billing?: Record<string, any>;
  ui?: Record<string, any>;
}

export async function getVerticalConfig(): Promise<VerticalRuntimeConfig> {
  // Fetch from /api/verticals/config at runtime
  const response = await fetch('/api/verticals/config', {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load vertical config');
  }

  const { config } = await response.json();
  return config;
}

export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const response = await fetch('/api/verticals/features', {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });

  if (!response.ok) {
    throw new Error('Failed to load feature flags');
  }

  const { features } = await response.json();
  return features;
}
```

**File**: `apps/web/src/lib/feature-flags.ts` (EDIT - add hook)

```typescript
import { useEffect, useState } from 'react';

export function useFeatureFlagServer(flagName: string): boolean {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    getFeatureFlags()
      .then((flags) => setEnabled(flags[flagName] ?? false))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [flagName]);

  return enabled;
}
```

#### 2.6 Menu Registry: Dynamic Vertical-Scoped Items
**File**: `apps/web/src/lib/menu-registry.ts` (EDIT - add vertical support)

```typescript
export interface MenuItemWithVertical extends MenuItem {
  verticalId?: string; // If specified, only show in this vertical
  requiredFeature?: string; // If specified, only show if feature enabled
}

export function getVisibleMenuItems(
  verticalId: string,
  enabledFeatures: Record<string, boolean>
): MenuItem[] {
  const allItems: MenuItemWithVertical[] = [
    // Shared items (no verticalId)
    { id: 'home', label: 'Home', icon: 'home' },
    { id: 'chat', label: 'Chat', icon: 'message' },

    // Finance-specific items
    {
      id: 'invoicing',
      label: 'Invoicing',
      icon: 'document',
      verticalId: 'finance',
      requiredFeature: 'invoicing',
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: 'credit-card',
      verticalId: 'finance',
    },

    // Healthcare-specific items
    {
      id: 'patients',
      label: 'Patients',
      icon: 'people',
      verticalId: 'healthcare',
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: 'calendar',
      verticalId: 'healthcare',
    },

    // Retail-specific items
    {
      id: 'inventory',
      label: 'Inventory',
      icon: 'box',
      verticalId: 'retail',
    },
    {
      id: 'orders',
      label: 'Orders',
      icon: 'shopping-cart',
      verticalId: 'retail',
    },
  ];

  return allItems.filter((item) => {
    // Filter by vertical
    if (item.verticalId && item.verticalId !== verticalId) {
      return false;
    }

    // Filter by feature flag
    if (item.requiredFeature && !enabledFeatures[item.requiredFeature]) {
      return false;
    }

    return true;
  });
}
```

#### 2.7 Acceptance Criteria
- ✅ Config loader service implemented and tested
- ✅ Request context middleware propagates tenant info
- ✅ Feature flags API endpoints working (GET, POST toggle, PUT config)
- ✅ Frontend hooks for feature flags implemented
- ✅ Menu registry filters by vertical and feature flags
- ✅ Integration tests pass (config + flags + menu visibility)
- ✅ Git feature branch: `feat/phase-2-infrastructure` created and tested

#### 2.8 Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| Config cache invalidation stale | Cache TTL=5min; explicit invalidation on update |
| Feature flag performance | Lazy-load flags only on-demand; cache aggressively |
| JWT decode errors | Graceful fallback; log and alert on errors |

---

## Phase 3: Vertical Templates (Week 2-3)

### Objective
Create scaffold templates for each vertical with sample prompts, schemas, and workflows.

### Deliverables

#### 3.1 Finance Vertical Template
**File**: `packages/vertical/finance/src/prompts/index.ts` (NEW)

```typescript
export const systemPrompt = `You are an AI financial assistant specialized in:
- Invoice generation and tracking
- Expense categorization
- Financial reporting
- Tax compliance guidance
- Accounting best practices

Context:
- Vertical: Finance
- Features: invoicing, expense-tracking, basic-reporting
- Integrations: QuickBooks (enabled), Xero (disabled)

Always provide accurate, professional financial guidance.`;

export const invoiceTemplate = `
---
Invoice #: {invoiceNumber}
Date: {date}
Due: {dueDate}

Bill To:
{clientName}
{clientAddress}

Items:
{items}

Subtotal: ${subtotal}
Tax ({taxRate}%): ${tax}
Total: ${total}

Terms: {terms}
---
`;
```

**File**: `packages/vertical/finance/src/schemas/invoice.ts` (NEW)

```typescript
import { z } from 'zod';

export const invoiceSchema = z.object({
  id: z.string().uuid(),
  number: z.string(),
  date: z.date(),
  dueDate: z.date(),
  clientId: z.string().uuid(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unitPrice: z.number().positive(),
      tax: z.number().min(0),
    })
  ),
  subtotal: z.number(),
  tax: z.number(),
  total: z.number(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue']),
});

export type Invoice = z.infer<typeof invoiceSchema>;
```

**File**: `packages/vertical/finance/src/workflows/index.ts` (NEW)

```typescript
export const invoicingWorkflow = {
  id: 'create-invoice',
  name: 'Create Invoice',
  steps: [
    {
      id: 'gather-details',
      name: 'Gather Invoice Details',
      type: 'form',
      fields: ['clientId', 'items', 'dueDate'],
    },
    {
      id: 'generate',
      name: 'Generate Invoice',
      type: 'ai',
      prompt: 'Generate a professional invoice PDF',
    },
    {
      id: 'send',
      name: 'Send to Client',
      type: 'integration',
      integration: 'email',
    },
  ],
};

export const expenseTrackingWorkflow = {
  id: 'track-expense',
  name: 'Track Expense',
  steps: [
    {
      id: 'receipt-upload',
      name: 'Upload Receipt',
      type: 'file-upload',
    },
    {
      id: 'categorize',
      name: 'Categorize Expense',
      type: 'ai',
      prompt: 'Categorize this expense',
    },
    {
      id: 'approve',
      name: 'Approve',
      type: 'approval',
    },
  ],
};
```

**File**: `packages/vertical/finance/src/integrations/index.ts` (NEW)

```typescript
export const stripeIntegration = {
  id: 'stripe',
  name: 'Stripe',
  enabled: true,
  capabilities: ['payment-processing', 'subscription-management'],
  requiredFeatures: [],
};

export const quickbooksIntegration = {
  id: 'quickbooks',
  name: 'QuickBooks Online',
  enabled: true,
  capabilities: ['sync-invoices', 'sync-expenses', 'financial-reporting'],
  requiredFeatures: [],
};

export const xeroIntegration = {
  id: 'xero',
  name: 'Xero',
  enabled: false,
  capabilities: ['sync-invoices', 'sync-expenses'],
  requiredFeatures: [],
};
```

**File**: `packages/vertical/finance/src/components/InvoiceForm.tsx` (NEW)

```typescript
import React from 'react';

export function InvoiceForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  return (
    <form onSubmit={onSubmit}>
      <input type="text" placeholder="Client Name" />
      <input type="date" placeholder="Invoice Date" />
      <input type="date" placeholder="Due Date" />
      {/* Additional fields */}
      <button type="submit">Generate Invoice</button>
    </form>
  );
}
```

#### 3.2 Healthcare Vertical Template (Similar structure)
**File**: `packages/vertical/healthcare/src/prompts/index.ts` (NEW)
**File**: `packages/vertical/healthcare/src/schemas/patient.ts` (NEW)
**File**: `packages/vertical/healthcare/src/workflows/index.ts` (NEW)
**File**: `packages/vertical/healthcare/src/integrations/index.ts` (NEW)

#### 3.3 Retail Vertical Template (Similar structure)
**File**: `packages/vertical/retail/src/prompts/index.ts` (NEW)
**File**: `packages/vertical/retail/src/schemas/product.ts` (NEW)
**File**: `packages/vertical/retail/src/workflows/index.ts` (NEW)
**File**: `packages/vertical/retail/src/integrations/index.ts` (NEW)

#### 3.4 Acceptance Criteria
- ✅ All 3 verticals (finance, healthcare, retail) scaffolded
- ✅ Each vertical has prompts, schemas, workflows, integrations, components
- ✅ TypeScript types generated from schemas
- ✅ `pnpm build:verticals` builds all without errors
- ✅ Git feature branch: `feat/phase-3-templates` created

---

## Phase 4: Feature Development (Week 3-5, Parallel)

### Objective
Implement vertical-specific features in parallel. Each feature team works on one vertical.

### Finance Feature Track
- Invoice generation API
- Expense tracking API
- QuickBooks sync integration
- Billing dashboard UI

### Healthcare Feature Track
- Patient records API
- Appointment scheduling API
- EHR integration (Epic, Cerner)
- Patient portal UI

### Retail Feature Track
- Inventory management API
- Order processing API
- POS integration
- Storefront UI

**Execution**: Teams work in parallel on separate branches; merge to main daily (CI passes).

---

## Phase 5: Testing & QA (Week 5-6)

### Unit Tests
```bash
pnpm test:verticals
```

### Integration Tests
- Multi-tenant isolation (accountId filtering)
- Feature flag gating
- Config loader caching

### E2E Tests
- Finance: Create invoice → Send → Paid status
- Healthcare: Book appointment → Receive reminder
- Retail: Add to inventory → Create order

---

## Phase 6: Deployment Pipeline (Week 6-7)

### Docker Setup
**File**: `Dockerfile` (EDIT - multi-stage)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist .
COPY --from=builder /app/packages ./packages
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
```

### CI/CD Pipeline
**File**: `.github/workflows/ci.yml` (EDIT)
- Run tests on PR
- Build Docker image
- Push to registry on merge
- Deploy to staging

---

## Phase 7: Go-Live & Rollout (Week 7-8+)

### Rollout Plan
1. **Week 1**: Finance internal testing
2. **Week 2**: Finance beta customers (feature flag: `finance:beta`)
3. **Week 3**: Finance GA
4. **Week 4**: Healthcare alpha
5. **Week 5**: Retail alpha
6. **Week 6+**: Scale and optimize

### Monitoring & Alerts
- Feature flag telemetry
- Per-vertical error rates
- Config cache hit rates
- API latency by vertical

---

## Success Criteria

### Functional
- ✅ Each vertical has isolated config, prompts, workflows
- ✅ Feature flags work; toggle without redeployment
- ✅ Multi-tenant isolation enforced at DB + API level
- ✅ Upstream sync runs weekly without breaking changes

### Operational
- ✅ <5 merge conflicts per week on rebase
- ✅ <2 seconds p95 latency for config loader
- ✅ 99.5% uptime across verticals
- ✅ Deployment turnaround: <15 min from PR → prod

### Developer Experience
- ✅ Onboard new developer in <1 day
- ✅ Add new vertical in <3 days (scaffold + workflows)
- ✅ Feature flag toggle via API within seconds
- ✅ Clear error messages for tenant mismatches

---

## Post-MVP Backlog

1. **Admin Panel for Feature Flags** — UI to toggle per-tenant
2. **Migration Tooling** — Move customer from one vertical to another
3. **Audit Logging** — Per-tenant activity logs
4. **Performance Tuning** — Config cache optimization, lazy-load integrations
5. **Security Hardening** — Encrypt integration credentials, audit API access
6. **Multi-Region Deployment** — Deploy to multiple regions per tenant
7. **A/B Testing Framework** — Test new features per-tenant before rollout

---

## Appendix: Key Files Summary

### Backend
- `apps/api/src/lib/config-loader.ts` — Config resolution
- `apps/api/src/middleware/tenant-context.ts` — Tenant propagation
- `apps/api/src/lib/feature-flags.ts` — Feature flag service
- `apps/api/src/routes/verticals.ts` — API endpoints

### Frontend
- `apps/web/src/lib/env-config.ts` — Vertical config fetching
- `apps/web/src/lib/feature-flags.ts` — Feature flag hooks
- `apps/web/src/lib/menu-registry.ts` — Dynamic menu rendering

### Database
- `packages/db/src/schema/vertical.ts` — New tables
- `packages/db/drizzle/migrations/001_add_vertical_tables.sql` — Schema migration

### Vertical Packages
- `packages/vertical/{finance,healthcare,retail}/` — Scaffolding
- Each vertical: prompts, schemas, workflows, integrations, components

### Root Config
- `pnpm-workspace.yaml` — Workspace config
- `tsconfig.base.json` — Path aliases
- `.github/workflows/sync-upstream.yml` — Fork sync automation

---

**Status**: Ready for execution. Phases 1-2 (~2 weeks) are critical path; Phase 3 onward parallelizable.
