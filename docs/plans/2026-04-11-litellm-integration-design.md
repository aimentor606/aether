# LiteLLM Integration Design Document

**Date**: 2026-04-11
**Status**: Draft — Pending Approval
**Author**: Sisyphus
**Scope**: Replace OpenRouter with LiteLLM Proxy Server as the unified LLM gateway

---

## 1. Executive Summary

Replace OpenRouter with a self-hosted LiteLLM Proxy Server cluster as the unified LLM gateway for the Acme SaaS platform. This gives us:

- **Cost control**: Direct provider connections, no middleman markup
- **Data sovereignty**: All LLM traffic stays on our infrastructure
- **Dual-mode keys**: Platform-managed virtual keys + user-provided API keys
- **High availability**: Model fallbacks, automatic retries, multi-instance deployment
- **Built-in cost tracking**: Per-key spend tracking with budget enforcement
- **Target capacity**: 500-1000 RPS with 4-6 LiteLLM instances + Redis

---

## 2. Architecture Overview

### Current State (OpenRouter)

```
Client → Acme API → proxyToOpenRouter() → OpenRouter → Providers
                              ↓
                    proxyToAnthropic() → OpenRouter → Anthropic
                              ↓
                    calculateCost() → deductLLMCredits() → DB
```

**Problems**:
- Single point of failure (OpenRouter)
- Data passes through third party
- Limited provider fallback
- Per-request markup from OpenRouter

### Target State (LiteLLM)

```
Client → Acme API → proxyToLiteLLM() → LiteLLM Cluster (×4-6) → Providers
                              ↓              ↓
                    extractUsage()     Redis (shared state)
                              ↓              ↓
                    calculateCost()    PostgreSQL (spend logs)
                              ↓
                    deductLLMCredits() → Acme DB
```

**Benefits**:
- Self-hosted, full control
- Automatic model fallbacks + retries
- Dual-mode keys (virtual + user-provided)
- LiteLLM spend tracking + Acme billing as cross-check
- Horizontal scaling via Redis

---

## 3. Component Mapping

### 3.1 Functions to Replace

| Current Function | File | Replacement |
|---|---|---|
| `proxyToOpenRouter(body, isStreaming)` | `services/llm.ts` | `proxyToLiteLLM(body, isStreaming)` |
| `proxyToAnthropic(body, isStreaming)` | `services/anthropic.ts` | **Removed** — LiteLLM handles Anthropic natively |
| `extractUsageFromStream(stream, ...)` | `routes/llm.ts` | **Keep** — LiteLLM SSE is OpenAI-compatible, parser works unchanged |
| `extractUsageFromAnthropicStream(stream, ...)` | `routes/anthropic.ts` | **Removed** — all models use OpenAI format through LiteLLM |
| `calculateCost(modelConfig, prompt, completion, ...)` | `services/llm.ts` | **Keep** — Acme's own billing, cross-checked with LiteLLM |
| `calculateAnthropicCost(modelConfig, usage, ...)` | `services/anthropic.ts` | **Removed** — unified via calculateCost |
| `MODELS` registry (openrouterId) | `config/models.ts` | Simplified — LiteLLM `config.yaml` handles routing |
| `resolveOpenRouterId(modelId)` | `config/models.ts` | **Removed** — LiteLLM resolves models internally |
| `ProxyServiceConfig` (OpenRouter entries) | `config/proxy-services.ts` | Updated to LiteLLM target |

### 3.2 Functions to Keep Unchanged

| Function | File | Why Keep |
|---|---|---|
| `calculateCost()` | `services/llm.ts` | Acme's own billing logic (credits/markup) |
| `extractUsageFromStream()` | `routes/llm.ts` | SSE parser — LiteLLM SSE is identical to OpenAI |
| `checkCredits()` / `deductLLMCredits()` | `services/billing.ts` | Acme credit system |
| `ProxyServiceConfig` (non-LLM entries) | `config/proxy-services.ts` | Tavily, Firecrawl, etc. still use direct proxy |
| `ModelConfig` interface | `config/models.ts` | Keep for pricing, simplify `openrouterId` → `litellmModel` |
| Secret store / auth sync | `core/kortix-master/` | Unchanged |

### 3.3 New Components

| Component | Purpose |
|---|---|
| `services/litellm.ts` | New proxy adapter — single entry point for all LLM calls |
| `config/litellm-config.ts` | LiteLLM connection config (URL, master key, timeout) |
| `infra/litellm/config.yaml` | LiteLLM Proxy model routing + fallback config |
| `infra/litellm/docker-compose.yml` | Multi-instance deployment |
| `infra/litellm/nginx.conf` | Load balancer config |

---

## 4. Adapter Layer Design

### 4.1 Core Proxy Function

```typescript
// apps/api/src/router/services/litellm.ts

import { LITELLM_URL, LITELLM_MASTER_KEY } from '../config/litellm-config';
import { getModel, ModelConfig } from '../config/models';
import { calculateCost } from './llm';

const LITELLM_BASE = `${LITELLM_URL}/v1`;

interface LiteLLMProxyOptions {
  body: Record<string, unknown>;
  isStreaming: boolean;
  accountId: string;
  sessionId?: string;
  /** If provided, use user's own API key via LiteLLM passthrough */
  userApiKey?: string;
}

/**
 * Unified LLM proxy through LiteLLM.
 * Replaces both proxyToOpenRouter() and proxyToAnthropic().
 */
export async function proxyToLiteLLM(
  options: LiteLLMProxyOptions
): Promise<Response> {
  const { body, isStreaming, userApiKey } = options;
  const modelId = body.model as string;

  // Resolve virtual key (platform-managed or user-specific)
  const virtualKey = await resolveVirtualKey(options.accountId);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${virtualKey}`,
  };

  // Dual-mode: inject user's own API key if provided
  const requestBody = { ...body };
  if (userApiKey) {
    requestBody.extra_body = {
      ...(requestBody.extra_body as Record<string, unknown> || {}),
      api_key: userApiKey,
    };
  }

  if (isStreaming) {
    requestBody.stream = true;
  }

  const response = await fetch(`${LITELLM_BASE}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new LiteLLMError(
      `LiteLLM proxy error: ${response.status}`,
      response.status,
      await response.text().catch(() => '')
    );
  }

  return response;
}
```

### 4.2 Virtual Key Management

```typescript
// apps/api/src/router/services/litellm-keys.ts

import { LITELLM_URL, LITELLM_MASTER_KEY } from '../config/litellm-config';

const LITELLM_BASE = `${LITELLM_URL}`;

/**
 * Get or create a virtual key for an account.
 * Maps Acme account → LiteLLM virtual key with budget enforcement.
 */
export async function resolveVirtualKey(accountId: string): Promise<string> {
  // Check cache first
  const cached = virtualKeyCache.get(accountId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.key;
  }

  // Look up existing key by alias
  const existing = await findKeyByAlias(accountId);
  if (existing) {
    virtualKeyCache.set(accountId, {
      key: existing.key,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min cache
    });
    return existing.key;
  }

  // Create new virtual key for this account
  const key = await createVirtualKey(accountId);
  virtualKeyCache.set(accountId, {
    key,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });
  return key;
}

async function createVirtualKey(accountId: string): Promise<string> {
  const account = await getAccountWithCredits(accountId);

  const response = await fetch(`${LITELLM_BASE}/key/generate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key_alias: `acme-${accountId}`,
      max_budget: account.creditBalance * CREDIT_TO_USD_RATE,
      budget_duration: '1mo',
      metadata: {
        account_id: accountId,
        plan: account.plan,
      },
    }),
  });

  const data = await response.json();
  return data.key;
}

async function findKeyByAlias(accountId: string): Promise<{ key: string } | null> {
  const response = await fetch(
    `${LITELLM_BASE}/key/info?key_alias=acme-${accountId}`,
    {
      headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` },
    }
  );

  if (!response.ok) return null;
  const data = await response.json();
  return data.keys?.[0] || null;
}

/**
 * Sync Acme credit balance → LiteLLM key budget.
 * Called when credits are purchased or deducted.
 */
export async function syncKeyBudget(
  accountId: string,
  newBudgetUsd: number
): Promise<void> {
  const keyInfo = await findKeyByAlias(accountId);
  if (!keyInfo) return;

  await fetch(`${LITELLM_BASE}/key/update`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LITELLM_MASTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: keyInfo.key,
      max_budget: newBudgetUsd,
    }),
  });
}
```

### 4.3 Config

```typescript
// apps/api/src/router/config/litellm-config.ts

import { z } from 'zod';

const litellmConfigSchema = z.object({
  LITELLM_URL: z.string().url().default('http://litellm:4000'),
  LITELLM_MASTER_KEY: z.string().min(1),
  LITELLM_TIMEOUT_MS: z.number().default(60000),
  LITELLM_REQUEST_TIMEOUT: z.number().default(600),
  LITELLM_NUM_RETRIES: z.number().default(3),
});

export const litellmConfig = litellmConfigSchema.parse({
  LITELLM_URL: process.env.LITELLM_URL,
  LITELLM_MASTER_KEY: process.env.LITELLM_MASTER_KEY,
  LITELLM_TIMEOUT_MS: parseInt(process.env.LITELLM_TIMEOUT_MS || '60000'),
  LITELLM_REQUEST_TIMEOUT: parseInt(process.env.LITELLM_REQUEST_TIMEOUT || '600'),
  LITELLM_NUM_RETRIES: parseInt(process.env.LITELLM_NUM_RETRIES || '3'),
});

export const {
  LITELLM_URL,
  LITELLM_MASTER_KEY,
  LITELLM_TIMEOUT_MS,
  LITELLM_REQUEST_TIMEOUT,
  LITELLM_NUM_RETRIES,
} = litellmConfig;
```

### 4.4 Model Registry Changes

```typescript
// apps/api/src/router/config/models.ts — MODIFIED

export interface ModelConfig {
  /** Model name as configured in LiteLLM config.yaml */
  litellmModel: string;           // RENAMED from openrouterId
  inputPer1M: number;
  outputPer1M: number;
  contextWindow: number;
  tier: 'free' | 'paid';
  cacheReadPer1M?: number;
  cacheWritePer1M?: number;
}

export const MODELS: Record<string, ModelConfig> = {
  'gpt-4o': {
    litellmModel: 'gpt-4o',        // LiteLLM resolves to provider
    inputPer1M: 2.50,
    outputPer1M: 10.00,
    contextWindow: 128000,
    tier: 'paid',
  },
  'claude-sonnet-4-20250514': {
    litellmModel: 'claude-sonnet-4-20250514',
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    contextWindow: 200000,
    tier: 'paid',
    cacheReadPer1M: 0.30,
    cacheWritePer1M: 3.75,
  },
  // ... more models
};

/** Get model config for billing calculation */
export function getModel(modelId: string): ModelConfig { /* unchanged */ }

/** REMOVED: resolveOpenRouterId() — LiteLLM handles model resolution */

/** REMOVED: getAllModels() — replaced by LiteLLM /models endpoint if needed */
```

### 4.5 Route Handler Changes

```typescript
// apps/api/src/router/routes/llm.ts — MODIFIED

// BEFORE:
import { proxyToOpenRouter } from '../services/llm';

// AFTER:
import { proxyToLiteLLM } from '../services/litellm';

// In the handler:
// BEFORE:
//   const response = await proxyToOpenRouter(body, isStreaming);

// AFTER:
const response = await proxyToLiteLLM({
  body,
  isStreaming,
  accountId,
  sessionId,
  userApiKey: extractUserApiKey(request),  // dual-mode
});

// extractUsageFromStream() is UNCHANGED — LiteLLM SSE is OpenAI-compatible
```

```typescript
// apps/api/src/router/routes/anthropic.ts — REPLACED

// BEFORE: separate Anthropic handler with proxyToAnthropic()
// AFTER: redirect to the unified LiteLLM handler

// Anthropic-format requests are translated to OpenAI format
// and sent through proxyToLiteLLM(). The route can be kept
// for backward compatibility but delegates to the unified path.

// OR: Remove the route entirely and have clients use /llm endpoint.
// Decision: TBD based on client compatibility needs.
```

---

## 5. LiteLLM Proxy Configuration

### 5.1 config.yaml

```yaml
# infra/litellm/config.yaml

model_list:
  # ─── GPT-4o (primary + fallback) ───
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  - model_name: gpt-4o                              # Fallback
    litellm_params:
      model: azure/gpt-4o
      api_key: os.environ/AZURE_API_KEY
      api_base: os.environ/AZURE_API_BASE

  # ─── Claude Sonnet 4 ───
  - model_name: claude-sonnet-4-20250514
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
  - model_name: claude-sonnet-4-20250514             # Fallback
    litellm_params:
      model: bedrock/anthropic.claude-sonnet-4-20250514-v1:0
      aws_access_key_id: os.environ/AWS_ACCESS_KEY_ID
      aws_secret_access_key: os.environ/AWS_SECRET_ACCESS_KEY
      aws_region_name: os.environ/AWS_REGION

  # ─── DeepSeek (cost-effective) ───
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY

  # ─── Free tier model ───
  - model_name: minimax-m2.7
    litellm_params:
      model: minimax/minimax-m2.7
      api_key: os.environ/MINIMAX_API_KEY

litellm_settings:
  # ── Routing ──
  routing_strategy: "simple-shuffle"                # Best performance for >500 RPS
  num_retries: 3
  request_timeout: 600
  fallbacks: true
  context_window_fallbacks: true

  # ── Dual-mode keys ──
  configurable_clientside_auth_params:
    - "api_key"           # OpenAI
    - "anthropic_key"     # Anthropic direct
    - "openai_key"        # OpenAI direct

  # ── Redis (multi-instance) ──
  redis_host: os.environ/REDIS_HOST
  redis_port: os.environ/REDIS_PORT
  redis_password: os.environ/REDIS_PASSWORD

  # ── Database ──
  database_url: os.environ/DATABASE_URL

  # ── Cost tracking ──
  success_callback: ["prometheus"]

  # ── Performance ──
  database_connection_pool_limit: 100
  database_connection_timeout: 60

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
```

### 5.2 Environment Variables

```bash
# .env (Acme API)
LITELLM_URL=http://litellm:4000
LITELLM_MASTER_KEY=sk-master-xxx

# LiteLLM container environment
LITELLM_MASTER_KEY=sk-master-xxx
DATABASE_URL=postgresql://litellm:password@postgres:5432/litellm
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=xxx

# Provider keys (used by LiteLLM config.yaml)
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
AZURE_API_KEY=xxx
AZURE_API_BASE=https://xxx.openai.azure.com
DEEPSEEK_API_KEY=sk-xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
OPENROUTER_API_KEY=sk-or-xxx      # Keep for niche model fallback
```

---

## 6. Deployment Architecture

### 6.1 Docker Compose

```yaml
# infra/litellm/docker-compose.yml

version: '3.8'

services:
  # ── LiteLLM Instances (×4 for 500-1000 RPS) ──
  litellm-1:
    image: ghcr.io/berriai/litellm:main-latest
    ports: ["4001:4000"]
    environment:
      LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY}
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    env_file: .env.providers
    volumes:
      - ./config.yaml:/app/config.yaml
    command: --config /app/config.yaml --port 4000
    depends_on: [redis, postgres]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  litellm-2:
    image: ghcr.io/berriai/litellm:main-latest
    ports: ["4002:4000"]
    environment:
      LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY}
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    env_file: .env.providers
    volumes:
      - ./config.yaml:/app/config.yaml
    command: --config /app/config.yaml --port 4000
    depends_on: [redis, postgres]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  litellm-3:
    image: ghcr.io/berriai/litellm:main-latest
    ports: ["4003:4000"]
    environment:
      LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY}
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    env_file: .env.providers
    volumes:
      - ./config.yaml:/app/config.yaml
    command: --config /app/config.yaml --port 4000
    depends_on: [redis, postgres]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  litellm-4:
    image: ghcr.io/berriai/litellm:main-latest
    ports: ["4004:4000"]
    environment:
      LITELLM_MASTER_KEY: ${LITELLM_MASTER_KEY}
      DATABASE_URL: ${DATABASE_URL}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_PASSWORD: ${REDIS_PASSWORD}
    env_file: .env.providers
    volumes:
      - ./config.yaml:/app/config.yaml
    command: --config /app/config.yaml --port 4000
    depends_on: [redis, postgres]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # ── Redis ──
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --requirepass ${REDIS_PASSWORD} --maxmemory 512mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data
    restart: unless-stopped

  # ── PostgreSQL ──
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: litellm
      POSTGRES_USER: litellm
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped

  # ── Nginx Load Balancer ──
  nginx:
    image: nginx:alpine
    ports: ["4000:80"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - litellm-1
      - litellm-2
      - litellm-3
      - litellm-4
    restart: unless-stopped

volumes:
  redis-data:
  postgres-data:
```

### 6.2 Nginx Config

```nginx
# infra/litellm/nginx.conf

upstream litellm_backend {
    least_conn;
    server litellm-1:4000;
    server litellm-2:4000;
    server litellm-3:4000;
    server litellm-4:4000;
}

server {
    listen 80;

    location / {
        proxy_pass http://litellm_backend;
        proxy_http_version 1.1;

        # SSE streaming support
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 600s;

        # Standard headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Health check passthrough
    location /health {
        proxy_pass http://litellm_backend/health;
    }
}
```

---

## 7. Billing Integration Strategy

### 7.1 Dual Billing Architecture

We keep **two independent billing systems** that cross-check each other:

```
┌──────────────────────────────────────────────────┐
│                  Acme Billing                     │
│  (existing: credits, markup, team budgets)        │
│                                                   │
│  calculateCost() → deductLLMCredits() → Acme DB  │
│  + extractUsageFromStream() for real-time extract │
└──────────────────────┬───────────────────────────┘
                       │ cross-check
┌──────────────────────▼───────────────────────────┐
│              LiteLLM Spend Tracking               │
│  (automatic: per-key budgets, model-level spend)  │
│                                                   │
│  completion_cost() → SpendLogs → LiteLLM DB      │
│  + /key/info for budget status                    │
└──────────────────────────────────────────────────┘
```

### 7.2 Why Dual Billing?

| Concern | Acme Billing | LiteLLM Billing |
|---|---|---|
| **Credit system** | ✅ Users buy credits | ❌ Only USD budgets |
| **Markup** | ✅ Platform markup | ❌ Direct cost only |
| **Real-time** | ✅ Stream extraction | ✅ Automatic tracking |
| **Team budgets** | ✅ Custom logic | ✅ Built-in |
| **Per-model limits** | ❌ Manual | ✅ Per-key model lists |
| **Rate limiting** | ❌ Manual | ✅ TPM/RPM per key |
| **Audit trail** | ✅ Custom queries | ✅ SpendLogs table |

### 7.3 Reconciliation Job (Daily)

```typescript
// packages/vertical/src/billing/reconciliation.ts

/**
 * Daily job: Compare Acme billing vs LiteLLM spend logs.
 * Alert on discrepancies > 5%.
 */
export async function reconcileSpend(): Promise<ReconciliationReport> {
  const acmeSpend = await getAcmeBillingSummary('1d');
  const litellmSpend = await getLiteLLMSpendSummary('1d');

  const discrepancies: Discrepancy[] = [];
  for (const [key, acme] of Object.entries(acmeSpend)) {
    const litellm = litellmSpend[key] || 0;
    const diff = Math.abs(acme - litellm) / acme;
    if (diff > 0.05) {
      discrepancies.push({
        account: key,
        acmeCost: acme,
        litellmCost: litellm,
        diffPercent: diff * 100,
      });
    }
  }

  return { date: new Date(), discrepancies, totalAccounts: Object.keys(acmeSpend).length };
}

async function getLiteLLMSpendSummary(period: string): Promise<Record<string, number>> {
  // Query LiteLLM SpendLogs directly (shared PostgreSQL or API)
  const response = await fetch(`${LITELLM_URL}/spend/keys`, {
    headers: { 'Authorization': `Bearer ${LITELLM_MASTER_KEY}` },
  });
  return response.json();
}
```

---

## 8. Migration Plan

### Phase 1: Infrastructure Setup (1-2 days)
1. Deploy LiteLLM Docker Compose (4 instances + Redis + PostgreSQL)
2. Configure `config.yaml` with all model providers
3. Set up Nginx load balancer
4. Verify health checks (`/health`, `/health/readiness`)
5. Generate master key

### Phase 2: Adapter Implementation (2-3 days)
1. Create `services/litellm.ts` — proxy adapter
2. Create `services/litellm-keys.ts` — virtual key management
3. Create `config/litellm-config.ts` — env validation
4. Update `config/models.ts` — rename `openrouterId` → `litellmModel`
5. Update `config/proxy-services.ts` — LLM entries point to LiteLLM
6. Update route handlers — `proxyToOpenRouter()` → `proxyToLiteLLM()`

### Phase 3: Testing (2-3 days)
1. Unit tests for adapter functions
2. Integration test: streaming SSE through LiteLLM
3. Integration test: dual-mode keys (virtual + user-provided)
4. Integration test: billing extraction + reconciliation
5. Load test: validate 500+ RPS
6. Load test: failover (kill 1 instance, verify continuity)

### Phase 4: Gradual Rollout (1-2 weeks)
1. Feature flag: `USE_LITELLM=false` (default off)
2. Enable for internal testing (5% traffic)
3. Enable for free-tier users (20% traffic)
4. Enable for all users (100% traffic)
5. Keep OpenRouter as fallback for 2 weeks
6. Remove OpenRouter code paths

### Phase 5: Cleanup (1-2 days)
1. Remove `proxyToOpenRouter()` and `proxyToAnthropic()`
2. Remove `extractUsageFromAnthropicStream()`
3. Remove `calculateAnthropicCost()`
4. Remove Anthropic-specific route handler (unified via LiteLLM)
5. Remove `OPENROUTER_API_KEY` from env (unless kept for niche models)
6. Update documentation

---

## 9. Risk Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| LiteLLM instance crash | Requests fail | Nginx health checks + 4 instances + automatic retry |
| Redis failure | Rate limits lost | Redis persistence (AOF) + fallback to single-instance mode |
| PostgreSQL downtime | Spend tracking lost | Read replicas + Acme billing still works independently |
| LiteLLM version upgrade breaks API | All LLM calls fail | Pin Docker image tag, test in staging first |
| LiteLLM supply chain attack | Security breach | Pin to verified SHA, scan Docker image, run as non-root |
| Model provider outage | Specific model fails | Fallback models in config.yaml (2+ per model name) |
| Virtual key budget drift | Over-billing | Daily reconciliation + Acme billing as hard limit |
| >500 RPS not achieved | Performance degradation | Add more instances (scale to 6-8), tune Redis |

---

## 10. Decisions (Resolved 2026-04-11)

| # | Question | Decision |
|---|---|---|
| 1 | Anthropic route compatibility | **统一到 `/litellm`** — 删除 `/anthropic` 和 `/llm` 路由 |
| 2 | LiteLLM DB sharing | **共享 Acme PostgreSQL** — 同一实例，不同 schema |
| 3 | Deployment | **Docker Compose** — 全环境统一 |
| 4 | Version pinning | **固定 tag** — 如 `v1.40.0` |
| 5 | OpenRouter retention | **删除** — 完全移除 OpenRouter |
| 6 | Mobile app LLM calls | **移动端直接调用 LLM 端点** — 需要同步更新移动端 API 路径 |
