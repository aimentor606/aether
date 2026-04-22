---
title: "refactor: Control Plane / Data Plane Separation"
type: refactor
status: active
date: 2026-04-21
---

# refactor: Control Plane / Data Plane Separation

## Overview

将 Aether API 从"控制面 + 数据面混合体"重构为"纯控制面"。数据面流量（LLM 调用、工具调用、Sandbox 预览）全部改为直连模式。Aether 只负责认证、计费、编排和凭证签发。

## Problem Frame

当前 Aether API 既做控制面（认证、计费、sandbox 编排），又做数据面代理（LLM proxy、工具 proxy、sandbox preview proxy）。这导致：

1. **双跳延迟** — 所有 LLM 请求经过 Aether → LiteLLM → 上游
2. **内存压力** — streaming 用 `response.tee()` 缓存整个响应体
3. **维护负担** — 每新增一个 LiteLLM 端点需手动添加 proxy 路由和计费逻辑
4. **覆盖不全** — 当前只代理了 `/chat/completions` 和 `/models`，embeddings、images、audio 等端点未覆盖
5. **代理绕过 LiteLLM** — `proxy.ts` 中 anthropic/openai/gemini 等直接调上游，绕过了 LiteLLM 的 fallback 和 key 轮转

## Requirements Trace

- R1. LLM 流量不经过 Aether 代理，客户端/sandbox 用 LiteLLM 虚拟 key 直连
- R2. 工具流量不经过 Aether 代理，工具 key 注入 sandbox secret store，sandbox 直连
- R3. Sandbox 预览不经过 Aether 代理，客户端用 provider URL 直连
- R4. 计费通过异步对账实现 — Aether cron 定期从 LiteLLM 拉取 spend logs
- R5. 所有 LiteLLM 端点自动可用，无需逐个添加 proxy 路由
- R6. Kong 路由区分控制面 `/v1/control/*` 和数据面 `/llm/*`
- R7. Kong `/v1/chat/completions` 路由永久保留，改为虚拟 key 认证（不做向后兼容迁移）
- R8. SDK 抽象凭证获取流程，开发者 TTHW < 2 min（Champion tier）

## Scope Boundaries

- 不改变 LiteLLM 的 config.yaml 模型配置
- 不改变 PostgreSQL schema（除 Unit 3 新增 `spend_reconciliation_state` 和 `spend_reconciliation_ledger` 表，需 Drizzle migration）
- 不改变 Sandbox 内部的 OpenCode agent 代码（只改环境变量注入）
- 不改变 Stripe billing 的核心逻辑（只改数据来源从实时扣费改为异步对账）
- 不做 mobile SDK 改造（React Native SDK 适配由 mobile 团队单独处理）
- 不做按账户工具 secret store（使用全局 Aether key 注入 sandbox）
- 弃用 BYOK passthrough 模式（用户自带 API key 的 0.1x 计费模式）。现有 BYOK 用户迁移到 Aether 虚拟 key

### Deferred to Separate Tasks

- Mobile SDK 适配（`apps/mobile/`）: 单独 PR
- Sandbox preview auth token 机制优化: 本计划保留现有 auth 端点，后续优化
- RLS session variable middleware: 与本重构无关，独立处理

## Context & Research

### Relevant Code and Patterns

- `apps/api/src/router/services/litellm-keys.ts` — 已实现虚拟 key 创建、查找、缓存（5min TTL）
- `apps/api/src/router/services/litellm.ts` — 当前 LiteLLM proxy（将删除）
- `apps/api/src/router/routes/litellm.ts` — chat/completions 路由（将删除）
- `apps/api/src/router/routes/proxy.ts` — 通用 proxy，870 行（LLM 部分删除，工具部分改为 secret 注入）
- `apps/api/src/router/config/proxy-services.ts` — 服务注册表（LLM 条目删除）
- `apps/api/src/sandbox-proxy/` — sandbox 预览 proxy（数据面逻辑删除，保留 auth/share 控制面端点）
- `apps/api/src/billing/services/credits.ts` — 积分扣费（改为接受 LiteLLM spend 数据）
- `apps/api/src/router/services/billing.ts` — LLM 计费检查（简化为只检查余额）
- `infra/litellm/config.yaml` — LiteLLM 配置（需加 success_callback）
- `scripts/deploy/core/kong.yml` — Kong 路由（需加 /llm/* 和 /v1/control/* 路由）
- `scripts/deploy/core/litellm.yml` — LiteLLM 服务定义（需暴露给 Kong）
- `core/docker/docker-compose.yml` — 本地 sandbox compose（需更新环境变量）

### Key Patterns

- 虚拟 key 别名格式: `aether-{accountId}`（已在 litellm-keys.ts 中使用）
- LiteLLM spend API: `GET /global/spend/logs?start_time=...&end_time=...`
- LiteLLM key budget API: `POST /key/update` with `max_budget` and `budget_duration`
- Sandbox secret 注入: 通过 `INTERNAL_SERVICE_KEY` 调 sandbox `/aether/secrets` API

## Key Technical Decisions

- **D1: 凭证签发端点**: 新增 `GET /v1/control/credentials`，返回 LiteLLM URL + 虚拟 key。复用现有 `resolveVirtualKey()` + `syncKeyBudget()`。
- **D2: 计费对账间隔**: 30 秒 cron。在 Aether `index.ts` 中用 `setInterval` 实现（与现有 croner 模式一致）。超支窗口通过 LiteLLM `max_budget` 硬限保护。
- **D3: Sandbox → LiteLLM 路径**: Local sandbox 用 Docker 内网 `http://litellm:4000`，Cloud sandbox 用 Kong 公网地址 `https://{PUBLIC_HOST}/llm`。Aether 按 sandbox provider 注入不同的 `LITELLM_BASE_URL`。
- **D4: 工具 key 注入**: 在 sandbox 创建/启动时，通过现有 `pool/env-injector.ts` 的 `buildEnvPayload` + `POST /env` 机制写入工具 key。注入**全局 Aether 持有的 API key**（如 `config.TAVILY_API_KEY`），不创建按账户 secret store。按用户 tier 决定注入哪些工具 key（Free tier 不注入）。同时移除现有代理 URL 注入（`TAVILY_API_URL` 等），改为直接上游 URL + key。注意：sandbox 将持有 Aether master secret，需确保 sandbox 隔离安全。
- **D5: Kong 路由策略**: Kong `/v1/chat/completions` 路由永久保留，改为虚拟 key 认证（移除 master key 注入）。客户端必须在 `Authorization` header 中提供虚拟 key。兼容 OpenAI SDK 格式。不做向后兼容迁移，直接切换。
- **D8: BYOK 弃用**: 当前 proxy 有三种计费模式（Aether key 1.2x、用户 BYOK 0.1x、免费 passthrough）。本重构只保留 Aether 虚拟 key 模式，BYOK passthrough（用户自带 key）和免费 passthrough 模式弃用。现有 BYOK 用户需迁移到 Aether 虚拟 key。0.1x 平台费收入将丢失，记录为已知 tradeoff。
- **D6: Sandbox preview**: 删除 Aether 中的 HTTP/WS proxy 逻辑。保留 `POST /v1/p/auth`（签发 preview token）和 `POST /v1/p/share`（生成分享 URL）作为控制面端点。客户端从 `GET /v1/control/sandboxes/{id}` 获取直连 URL。
- **D7: 删除范围**: `router/routes/litellm.ts` 全部删除。`router/routes/proxy.ts` 删除 LLM 部分（~600 行），保留工具部分或整体删除改为 secret 注入。`sandbox-proxy/routes/preview.ts` 和 `sandbox-proxy/routes/local-preview.ts` 的 proxy 逻辑删除。

## Open Questions

### Resolved During Planning

- Q: 工具服务（tavily/serper）是否也走 LiteLLM？ → A: 不走。LiteLLM 不支持非 LLM 服务代理。改为注入 sandbox secret store。
- Q: Sandbox 是否经过 Kong？ → A: Local sandbox 走内网直连 LiteLLM。Cloud sandbox 走 Kong 到 LiteLLM。Sandbox preview 不经过 Kong（用 provider 自带 URL）。

### Deferred to Implementation

- LiteLLM success_callback 的具体配置方式（Webhook vs 自定义 callback）: 需要查看 LiteLLM 文档确认
- 虚拟 key 的 key rotation 策略: 初始版本不做 rotation，后续迭代
- `router/services/anthropic.ts` 去向: 当前提供 Anthropic 原生 `/v1/messages` 代理，Unit 6 需确认是否一并删除或迁移到 LiteLLM
- `router/routes/litellm-admin.ts` 定位: `/litellm-admin/*` 路由（health、model/info）与新的 `/v1/control/credentials` 重叠部分需理清，是否迁移到 `/v1/control/*`
- `router/config/model-pricing.ts` 和 `router/config/models.ts` 清理: Unit 6 删除 LLM proxy 后，这些配置文件是否还需要保留给 litellm-admin 使用

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification.*

```
                    Kong (:80/:443)
                    TLS + CORS + Rate Limit
                   ┌─────┼──────────┐
                   │     │          │
          /v1/control/*  /llm/*    /v1/chat/completions
               │           │        (虚拟 key 认证, OpenAI 兼容)
      ┌────────▼──┐  ┌────▼─────┐  ┌──────────────┐
      │ Aether API│  │ LiteLLM  │  │ LiteLLM      │
      │ :8008     │  │ :4000    │  │ (虚拟 key)   │
      │ (纯控制面) │  │          │  └──────────────┘
      └────┬──┬───┘  └────┬─────┘
           │  │            │
     ┌─────┘  └─ cron ───→│ spend/logs
     │         (30s)       │
     ▼                     ▼
  PostgreSQL         Upstream LLMs
```

**Credential Issuance Flow:**
```
1. Client → GET /v1/control/credentials (aether_ token)
2. Aether → resolveVirtualKey(accountId) → find or create in LiteLLM
3. Aether → syncKeyBudget(accountId, balance) → push max_budget to LiteLLM
4. Aether → { litellm_url, api_key } → Client
5. Client → POST https://llm.aether.dev/v1/chat/completions (virtual key)
```

**Billing Reconciliation Flow:**
```
1. Every 30s: Aether cron → GET LiteLLM /global/spend/logs?start_time=...
2. For each entry: key_alias "aether-{accountId}" → accountId
3. deductCredits(accountId, costUsd, "LiteLLM spend: {model}")  — USD直接扣费
4. syncKeyBudget(accountId, remainingBalance) → update LiteLLM max_budget
```

## Implementation Units

### Phase 1: Credential Issuance (控制面凭证签发)

- [x] **Unit 1: Add credential issuance endpoint**

**Goal:** 客户端和 sandbox 可通过 Aether API 获取 LiteLLM 虚拟 key 和连接信息。

**Requirements:** R1, R5

**Dependencies:** Unit 2 (needs `LITELLM_PUBLIC_URL` env var)

**Files:**
- Create: `apps/api/src/router/routes/credentials.ts`
- Modify: `apps/api/src/router/index.ts`
- Test: `apps/api/src/__tests__/e2e-credentials.test.ts`

**Approach:**
- 新增 `GET /v1/control/credentials` 端点，建立 `/v1/control/*` 控制面命名空间
- 复用 `router/services/litellm-keys.ts` 中已有的 `resolveVirtualKey()` 和 `syncKeyBudget()`
- 用 Zod 定义响应 schema（同时作为 TypeScript 类型、运行时验证、API 文档）：
  ```typescript
  const CredentialResponseSchema = z.object({
    litellm_url: z.string().url(),      // 客户端直连 LiteLLM 的地址
    api_key: z.string(),                // 虚拟 key (sk-...)
    key_alias: z.string(),              // aether-{accountId}
    models: z.array(z.string()).optional(), // 可用模型列表（按 tier）
  });
  ```
- 注意：`litellm-keys.ts:88-115` 创建 key 时不设 expiry，虚拟 key 永久有效直到删除。不返回 `expires_at`。
- `litellm_url` 从 `LITELLM_PUBLIC_URL` env var 读取（Unit 2 新增）
- 按用户 tier 决定可访问的模型范围（通过 LiteLLM key 的 `models` 参数）
- 端点使用 `combinedAuth` 中间件保护（接受 aether_ token 或 Supabase JWT）

**Patterns to follow:**
- `router/routes/litellm.ts` 中的 Hono 路由模式
- `router/services/litellm-keys.ts` 中的虚拟 key 管理模式

**Test scenarios:**
- Happy path: 有效 aether_ token → 返回虚拟 key + LiteLLM URL
- Edge case: 首次请求创建 key，后续请求复用缓存
- Edge case: 余额不足时仍返回 key（LiteLLM max_budget=0 会阻止调用）
- Error path: 无效 token → 401
- Error path: LiteLLM 不可达 → 502 with clear message
- Integration: key 返回后可成功调用 LiteLLM chat/completions

**Verification:**
- `bun test src/__tests__/e2e-credentials.test.ts` 通过
- curl 验证端点返回合法虚拟 key

---

- [x] **Unit 1b: Add SDK credential abstraction (DX requirement)**

**Goal:** SDK 消费者（前端/移动端）通过一个函数调用即可获取 LLM 访问能力，无需了解凭证获取流程。

**Requirements:** R1 (DX: Champion TTHW < 2 min)

**Dependencies:** Unit 1

**Files:**
- Create: `packages/sdk/src/llm/credentials.ts`
- Create: `packages/sdk/src/llm/errors.ts`
- Modify: `packages/sdk/src/llm/index.ts`
- Test: `packages/sdk/src/__tests__/llm-credentials.test.ts`

**Approach:**
- 新增 `fetchCredentials(apiClient)` 函数：调用 `GET /v1/control/credentials`，返回 Zod 验证后的响应
- 新增 `createLLMProvider(apiClient)` 函数：返回一个 fetch-like 对象，自动附加虚拟 key 和 LiteLLM URL
- 新增 React hook `useLLMCredentials()`：使用 React Query 缓存凭证（staleTime: 5min，对应服务端缓存 TTL）
- 新增 `packages/sdk/src/llm/errors.ts`：LiteLLM 错误 → Aether 风格错误映射

```typescript
// 使用示例 — SDK 消费者的 hello world
const { data: cred } = useLLMCredentials();
// cred.api_key, cred.litellm_url 自动获取和缓存

// 或者更低层级：
const llm = createLLMProvider(apiClient);
const response = await llm.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'hello' }],
  stream: true,
});
```

**LiteLLM → Aether 错误映射表：**

| LiteLLM Error | HTTP Status | SDK Error | User Message |
|---------------|-------------|-----------|-------------|
| `Key has exceeded budget` | 429 | `BudgetExhaustedError` | "Insufficient credits. Visit billing to top up." |
| `Model not found` | 404 | `ModelNotAvailableError` | "Model {name} is not available on your plan." |
| `Rate limit exceeded` | 429 | `RateLimitedError` | "Too many requests. Retry in {seconds}s." |
| `Invalid API key` | 401 | `CredentialExpiredError` | "LLM credentials expired. Refreshing..." (auto-retry once) |
| `No available provider` | 503 | `ProviderUnavailableError` | "All LLM providers are busy. Retry in a moment." |

**Patterns to follow:**
- `packages/sdk/src/api/client.ts` 中的 `createApiClient` 模式
- `packages/sdk/src/client/hooks/` 中的 React Query hook 模式

**Test scenarios:**
- Happy path: `useLLMCredentials()` 返回有效凭证
- Edge case: 凭证缓存 5 分钟内不重新请求
- Edge case: LiteLLM 返回 429 budget exceeded → SDK 抛出 BudgetExhaustedError
- Error path: Aether 不可达 → SDK 抛出清晰错误 "Unable to fetch LLM credentials"
- Integration: `createLLMProvider` + LiteLLM 调用成功返回 streaming response

**Verification:**
- `bun test packages/sdk/src/__tests__/llm-credentials.test.ts` 通过
- TypeScript 类型正确导出

**Goal:** LiteLLM 支持公开访问和用量回传。

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `apps/api/src/router/config/litellm-config.ts`
- Modify: `infra/litellm/config.yaml`
- Modify: `scripts/deploy/core/litellm.yml`
- Modify: `scripts/deploy/core/config/litellm/config.yaml`

**Approach:**
- litellm-config.ts 新增 `LITELLM_PUBLIC_URL` env var（面向客户端的地址）
- config.yaml 添加 `success_callback` 配置（prometheus + 可能的 webhook）
- litellm.yml 确保端口映射正确（Kong 可访问）
- 部署侧的 config.yaml 同步更新

**Patterns to follow:**
- `router/config/litellm-config.ts` 中的 Zod env 验证模式

**Test scenarios:**
- Happy path: LITELLM_PUBLIC_URL 正确解析
- Edge case: 缺少 LITELLM_PUBLIC_URL 时 fallback 到 LITELLM_URL
- Test expectation: none — config validation only, 行为测试在 Unit 1 覆盖

**Verification:**
- `bun run typecheck` 通过
- LiteLLM health endpoint 返回 200

---

- [x] **Unit 3: Add billing reconciliation cron**

**Goal:** Aether 定期从 LiteLLM 拉取用量数据，按虚拟 key 扣减用户积分。

**Requirements:** R4

**Dependencies:** Unit 1

**Files:**
- Create: `apps/api/src/router/services/spend-reconciler.ts`
- Modify: `apps/api/src/index.ts`（注册 cron）
- Test: `apps/api/src/__tests__/unit-spend-reconciler.test.ts`

**Approach:**
- **PRE-IMPLEMENTATION GATE**: 实现 Unit 3 之前，先验证 LiteLLM spend API：(1) curl `GET /global/spend/logs` 确认 endpoint 存在且返回按请求粒度的日志（含唯一 ID），(2) 记录实际 response format，(3) 据此调整幂等去重逻辑。若 API 只返回按 key 聚合数据，需改为差量对账模式（比较两次快照的总 spend 差值），此时 `spend_reconciliation_ledger` 的去重设计需重新评估。此 gate 阻塞 Unit 3 实现。
- 新增 `spend-reconciler.ts`，实现 `reconcileSpend()` 函数
- 调用 LiteLLM `GET /global/spend/logs?start_time={lastRun}&end_time={now}`
- 按 `key_alias` 格式 `aether-{accountId}` 提取 accountId
- **不使用 `deductLLMCredits()`**（需要 input/output tokens 分离，LiteLLM spend logs 不提供）。改用 `billing/services/credits.ts` 中的 `deductCredits(accountId, costUsd, description)` 直接按 USD 扣费
- 成功后调用 `syncKeyBudget()` 更新 LiteLLM max_budget
- **Feature flag**: 新增 `RECONCILIATION_ENABLED` env var，默认 `false`。Phase 3 部署（移除 LLM proxy）后才设为 `true`。防止 Phase 1-2 期间实时 proxy 扣费与异步对账双倍计费。Phase 3 部署时设为 `true` 并验证一轮对账正常后才开放
- 在 `index.ts` 中用 `setInterval` 或 `croner` 注册 30 秒定时任务（检查 `RECONCILIATION_ENABLED`）
- lastRun timestamp 持久化到 DB（新建 `spend_reconciliation_state` 表，单行记录 `last_processed_at`）。**不可仅存内存** — Aether 重启后内存丢失会导致重新拉取已处理记录，造成重复扣费
- **幂等扣费**: 新建 `spend_reconciliation_ledger` 表记录每个已处理的 spend log ID（LiteLLM 返回的唯一标识）。扣费前先查询该表，跳过已处理记录。防止 Aether 重启或多实例并发导致重复扣费
- **并发 budget sync**: 使用 `Promise.allSettled` + 并发限制（如 10 个）批量调用 `syncKeyBudget`。单个失败记录 warning 不阻塞整体。避免 100+ 活跃账户时顺序 HTTP 调用超过 30s cron 间隔

**Patterns to follow:**
- `billing/services/credits.ts` 中的 `deductCredits` (USD 直接扣费) 模式
- `index.ts` 中 `startAutoReplenish` / `startProvisionPoller` 等定时任务注册模式
- `litellm-keys.ts` 中的 key_alias 格式 `aether-{accountId}`

**Test scenarios:**
- Happy path: 有 spend 记录 → 正确扣费 → 更新 budget
- Edge case: 无 spend 记录 → 不扣费，正常完成
- Edge case: 重复 spend 记录（幂等性）→ 查 spend_reconciliation_ledger 去重，不重复扣费
- Error path: LiteLLM 不可达 → 记录 warning，不中断服务
- Error path: 未知 key_alias → 跳过，记 warning
- Integration: spend → deduct → syncKeyBudget 完整链路
- Edge case: Partial failure — deductCredits 在第 3/5 条记录失败 → lastRun 不更新，下次运行时 idempotency table 跳过已处理记录，补扣剩余记录

**Verification:**
- `bun test src/__tests__/unit-spend-reconciler.test.ts` 通过
- 手动触发 cron 后检查 DB transactions 表有新记录

---

- [x] **Unit 4: Add sandbox secret provisioning**

**Goal:** Sandbox 启动时，Aether 自动注入 LLM key 和工具 key 到 sandbox secret store。

**Requirements:** R2

**Dependencies:** Unit 1

**Files:**
- Modify: `apps/api/src/platform/pool/env-injector.ts`（扩展 `buildEnvPayload`）
- Modify: `apps/api/src/platform/services/sandbox-provisioner.ts`
- Test: `apps/api/src/__tests__/unit-sandbox-secrets.test.ts`

**Approach:**
- **复用现有 `pool/env-injector.ts` 的 `buildEnvPayload` + `POST /env` 机制**，不创建新 API
- 修改 `buildEnvPayload` 以注入新的环境变量：
  - `LITELLM_API_KEY` = resolveVirtualKey(accountId)
  - `LITELLM_BASE_URL` = 按 provider 决定内网/公网地址
  - `TAVILY_API_KEY` = config.TAVILY_API_KEY（全局 Aether key，按 tier 决定是否注入）
  - `SERPER_API_KEY` = config.SERPER_API_KEY（全局 Aether key，按 tier 决定是否注入）
  - `FIRECRAWL_API_KEY` = config.FIRECRAWL_API_KEY（全局 Aether key，按 tier 决定是否注入）
- **注入的是全局 Aether master key**，不是按账户 key。所有 sandbox 持有相同的工具 API key。依赖 sandbox 容器隔离保证安全。后续迭代可改为按账户 secret store（需 DB schema 变更，不在本计划 scope）
- **同时移除 `buildEnvPayload` 中现有的代理 URL 注入**（`TAVILY_API_URL`, `SERPER_API_URL`, `FIRECRAWL_API_URL`），改为直接上游 URL（如 `https://api.tavily.com`）+ 直接注入 key
- 在 `sandbox-provisioner.ts` 的 provision 流程中，确保 `buildEnvPayload` 被调用时传入 accountId

**Patterns to follow:**
- `platform/services/sandbox-provisioner.ts` 中的 provision 流程
- `core/docker/docker-compose.yml` 中的 sandbox 环境变量模式

**Test scenarios:**
- Happy path: 注入所有 secrets → sandbox 收到正确的 key
- Edge case: Local sandbox → LITELLM_BASE_URL 为内网地址
- Edge case: Daytona sandbox → LITELLM_BASE_URL 为公网地址
- Edge case: Free tier → 不注入工具 key
- Error path: Sandbox 不可达 → 记录 warning，不影响 sandbox 创建
- Error path: LiteLLM 虚拟 key 创建失败 → sandbox 仍创建但 LLM 不可用

**Migration note:** 已运行的 sandbox 仍持有旧的 `TAVILY_API_URL` 等代理 URL。Unit 8 删除 tool proxy 后这些 sandbox 会失去工具访问。**必须在 Phase 4 部署前执行一次性迁移脚本**：查询所有运行中 sandbox，调用 `pool/env-injector.ts` 的 `inject()` 重新注入包含新 key 的环境变量。此脚本可在 Unit 4 完成后、Unit 8 部署前的任意时间运行。

**Verification:**
- `bun test src/__tests__/unit-sandbox-secrets.test.ts` 通过
- 创建 sandbox 后检查其 secret store 包含预期的 key

### Phase 2: Kong Routing (网关路由改造)

- [x] **Unit 5: Update Kong routing configuration**

**Goal:** Kong 区分控制面路由和数据面路由，LiteLLM 通过 Kong 对外提供 `/llm/*` 服务。

**Requirements:** R6, R7

**Dependencies:** Unit 1

**Files:**
- Modify: `scripts/deploy/core/kong.yml`
- Modify: `scripts/deploy/core/compose-kong.yml`（如需要）
- Modify: `scripts/deploy/ops/.env.example`

**Approach:**
- **当前 Kong 配置结构问题**: 现有 `svc-api` 和 `svc-litellm-ui` 全部指向 LiteLLM，没有独立的 Aether API service。需要根本性重构路由结构。
- 确认 Aether API 在 Kong 所在 Docker 网络中可达（需检查 `compose-kong.yml` 中 Aether API container 是否在同一 network）
- 新增 `svc-control` service 指向 Aether API（`aether-api:8008`，需确认 container name）
- 新增 `route-control` 路由 `/v1/control` 到 Aether API
- 新增 `svc-llm` service 指向 LiteLLM（`llm-proxy:4000`）
- 新增 `route-llm` 路由 `/llm` 到 LiteLLM，`strip_path: true`
- 修改 `/v1/chat/completions` 路由：**移除 master key 注入**，改为透传客户端 `Authorization` header（虚拟 key 认证）
- 新增 env vars: `DECK_AETHER_API_PORT`, `DECK_LLM_PROXY_PORT`

**Patterns to follow:**
- `scripts/deploy/core/kong.yml` 中的现有 service/route/plugin 模式

**Test scenarios:**
- Happy path: `GET /llm/models` with virtual key → 200
- Happy path: `GET /v1/control/credentials` with aether_ token → 200
- Happy path: `POST /v1/chat/completions` with virtual key `Authorization: Bearer sk-...` → 200
- Error path: `POST /v1/chat/completions` without auth → LiteLLM 返回 401（不再是 master key 注入）
- Error path: `/llm/*` 无认证 → LiteLLM 返回 401
- Error path: Kong rate limiting 生效

**Verification:**
- `ops/sync-kong.sh` 成功
- `ops/verify.sh` 通过
- curl 测试新路由

### Phase 3: Cleanup (数据面代理代码清理)

- [x] **Unit 6: Remove LLM proxy code**

**Goal:** 删除 Aether 中所有 LLM 数据面代理代码。

**Requirements:** R1, R5

**Dependencies:** Unit 1, Unit 5

**Files:**
- Delete: `apps/api/src/router/routes/litellm.ts`
- Delete: `apps/api/src/router/services/litellm.ts`（proxyToLiteLLM 函数）
- Modify: `apps/api/src/router/index.ts`（移除 litellm 路由挂载，proxy 挂载改为 proxy-tools）
- Delete: `apps/api/src/router/routes/proxy.ts`（整体删除，不再做部分删减）
- Create: `apps/api/src/router/routes/proxy-tools.ts`（从 proxy.ts 提取工具代理部分，临时文件，Phase 4 Unit 8 删除）
- Delete: `apps/api/src/router/config/proxy-services.ts`（整体删除）
- Create: `apps/api/src/router/config/proxy-tool-services.ts`（提取工具服务定义，Phase 4 Unit 8 删除）
- Modify: `apps/api/src/index.ts`（移除 LLM proxy 相关 import 和 initModelPricing 调用）
- Update: `apps/api/src/__tests__/e2e-router.test.ts`（更新测试用例）

**Approach:**
- 删除 `litellm.ts` 路由文件和 `services/litellm.ts` 中的 proxyToLiteLLM
- 从 `proxy-services.ts` 中移除所有 `isLlm: true` 的服务条目
- 从 `proxy.ts` 中移除 LLM 相关的 billing 函数（billLlmAetherProxy, billLlmPassthrough, extractUsageFromAetherProxyStream, extractUsageFromPassthroughStream）
- 保留 `proxy.ts` 中的工具服务（tavily/serper/firecrawl/replicate/context7）暂时不动（Unit 8 处理）
- `router/index.ts` 中移除 litellm 路由挂载，保留 search 和 finance 路由
- `index.ts` 中移除 `initModelPricing` 和 `stopModelPricing` 调用

**Patterns to follow:**
- 保持 Hono sub-app 的挂载/卸载模式

**Test scenarios:**
- Happy path: `/v1/router/chat/completions` 不再由 Aether 处理（由 Kong 路由到 LiteLLM）
- Happy path: `/v1/router/models` 端点保留（返回本地模型注册表）
- Happy path: `/v1/router/web-search` 和 `/v1/router/image-search` 仍正常工作
- Happy path: `/v1/router/tavily/*` 等工具路由仍正常工作
- Regression: billing 端点、platform 端点不受影响
- Regression: 所有非 LLM 的 e2e 测试仍通过

**Verification:**
- `bun run typecheck` 通过
- `bun test` 通过（更新后的测试）
- curl 验证 LLM 路由不再由 Aether 直接响应

---

- [x] **Unit 7: Remove sandbox preview proxy (data plane)**

**Goal:** 删除 Aether 中 sandbox HTTP/WS proxy 代码，保留控制面端点（auth、share）。

**Requirements:** R3

**Dependencies:** Unit 1

**Files:**
- Delete: `apps/api/src/sandbox-proxy/routes/preview.ts`（Daytona proxy 逻辑）
- Delete: `apps/api/src/sandbox-proxy/routes/local-preview.ts`（Docker proxy 逻辑）
- Modify: `apps/api/src/sandbox-proxy/index.ts`（移除 proxy 路由，保留 auth 和 share）
- Modify: `apps/api/src/index.ts`（移除 Bun server 级别的 WebSocket proxy 逻辑 ~340 行，简化 sandbox-proxy 挂载）
- Modify: `apps/api/src/startup/ws-proxy-helpers.ts`（删除或大幅简化）
- Modify: `apps/api/src/startup/subdomain-preview.ts`（删除或大幅简化）
- Modify: `apps/api/src/platform/routes/sandbox-cloud.ts`（`GET /v1/platform/sandboxes/{id}` 返回直连 URL）
- Update: `apps/api/src/__tests__/e2e-preview-proxy.test.ts`

**Approach:**
- 删除 `preview.ts` 和 `local-preview.ts` 中的 HTTP/WS 代理逻辑
- **关键**: `index.ts:405-744` 包含 Bun server 级别的 `fetch` 和 `websocket` 处理器，处理 subdomain preview HTTP/WS 路由（~340 行）。这些必须一并删除。提取 `WsProxyData`, `WS_CONNECT_TIMEOUT_MS` 等类型的 `startup/ws-proxy-helpers.ts` 也需要清理。
- `sandbox-proxy/index.ts` 只保留 `/auth` 和 `/share` 路由
- `sandbox-cloud.ts` 的 sandbox 详情端点返回 `preview_url` 字段：
  - Daytona: `{externalId}-{port}.daytona.cloud`
  - JustAVPS: `{port}--{slug}.aether.cloud`
  - Local: `http://localhost:{mappedPort}`
- 删除 `sandbox-proxy/index.ts` 中的 `resolveProvider` 函数（proxy 不再需要）
- 保留 `combinedAuth` middleware 对 auth/share 端点的保护

**Test scenarios:**
- Happy path: `GET /v1/platform/sandboxes/{id}` 返回 preview_url
- Happy path: `POST /v1/p/auth` 签发 preview cookie 仍正常
- Happy path: `POST /v1/p/share` 生成分享 URL 仍正常
- Edge case: 各 provider 返回不同格式的 URL
- Error path: sandbox 不存在 → 404
- Regression: sandbox CRUD 端点不受影响

**Verification:**
- `bun run typecheck` 通过
- `bun test` 通过（更新后）
- 前端能通过新 URL 访问 sandbox preview

### Phase 4: Tool Proxy → Secret Injection (工具代理改造)

- [x] **Unit 8: Replace tool proxy with secret injection**

**Goal:** 工具 API key 不再通过 Aether proxy 注入，改为写入 sandbox secret store。删除 `proxy.ts` 中工具代理逻辑。

**Requirements:** R2

**Dependencies:** Unit 4, Unit 6

**Files:**
- Delete: `apps/api/src/router/routes/proxy-tools.ts`（Unit 6 创建的临时工具代理文件）
- Delete: `apps/api/src/router/config/proxy-tool-services.ts`（Unit 6 创建的临时工具服务定义）
- Modify: `apps/api/src/router/index.ts`（移除 proxy-tools 挂载）
- Modify: `apps/api/src/index.ts`（移除 proxy 相关 import）
- Update: `apps/api/src/__tests__/e2e-router.test.ts`（移除 proxy 测试用例）

**Approach:**
- Unit 4 已实现 sandbox secret 注入，本单元删除 proxy 层代码
- 如果有外部客户端（非 sandbox）也需要调用工具服务，需保留一个轻量级凭证分发端点
- 否则直接删除整个 proxy.ts 和 proxy-services.ts
- 从 `router/index.ts` 中移除 `proxy` 的挂载

**Test scenarios:**
- Happy path: Sandbox 能用注入的 key 直接调用 tavily/serper
- Regression: Router 的其他功能（search、finance）不受影响
- Regression: Billing 端点不受影响

**Verification:**
- `bun run typecheck` 通过
- `bun test` 通过
- Sandbox agent 能成功调用工具服务

## System-Wide Impact

- **Interaction graph:**
  - `index.ts` 的 import 列表大幅缩减（移除 proxy、litellm、sandbox-proxy 的数据面 import）
  - `router/index.ts` 简化（移除 litellm 挂载和 proxy 挂载）
  - `sandbox-proxy/index.ts` 大幅简化（只保留 auth/share）
  - `platform/services/sandbox-provisioner.ts` 新增 secrets 注入步骤
- **Error propagation:**
  - LiteLLM 不可达时，凭证签发端点返回 502
  - Spend reconciler 失败时记录 warning，不中断主服务
  - Sandbox secret 注入失败时记录 warning，sandbox 仍创建但缺少工具 key
- **State lifecycle risks:**
  - 虚拟 key 缓存（5min TTL）在 Aether 重启后清空，首次请求会重新创建
  - Spend reconciler 的 lastRun timestamp 在内存中，Aether 重启会从默认时间开始
  - 并发 reconcile 需要考虑（用 Redis lock 或幂等扣费）
- **API surface parity:**
  - 新增: `GET /v1/control/credentials`（Zod-validated response）
  - 新增: Kong 路由 `/llm/*`（虚拟 key 认证）
  - 变更: Kong `/v1/chat/completions` 从 master key 注入改为虚拟 key 认证（不做向后兼容）
  - 移除: `POST /v1/router/tavily/*`, `/v1/router/serper/*` 等 proxy 路由
  - 变更: `GET /v1/platform/sandboxes/{id}` 新增 `preview_url` 字段
  - 新增: `packages/sdk/src/llm/credentials.ts`（SDK 凭证抽象 + React hook）
  - 新增: `packages/sdk/src/llm/errors.ts`（LiteLLM → Aether 错误映射）
- **Unchanged invariants:**
  - Billing API (`/v1/billing/*`) 不变
  - Platform API (`/v1/platform/*`) 不变（除了 sandbox 详情新增字段）
  - Auth middleware 不变
  - Vertical API (`/v1/verticals/*`) 不变
  - Admin API (`/v1/admin/*`) 不变

## Coexistence Note

Unit 4 (sandbox secret injection, Phase 1) 和 Unit 8 (tool proxy 删除, Phase 4) 之间，tool proxy 和 secret injection **双路径并存**。这意味着：

- Sandbox 创建后同时获得：注入的 secret key + 仍可用的 `/v1/router/tavily/*` proxy 路由
- OpenCode agent 可以用任一方式访问工具服务
- Phase 4 删除 proxy 后，agent 必须使用注入的 key 直连
- **迁移安全**：不需要一次性切换，可逐步验证 sandbox 直连后再删除 proxy

## Risks & Dependencies

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| LiteLLM spend API 格式变更 | Low | High | 版本锁定 litellm image tag；spend reconciler 做防御性解析 |
| 30s 对账窗口内的超支 | Medium | Medium | syncKeyBudget 推送 max_budget 硬限；缩短间隔到 10s |
| Sandbox 无法访问 LiteLLM（网络隔离） | Medium | High | Daytona sandbox 走 Kong 公网；Local sandbox 走 Docker 内网 |
| 前端 SDK 不支持新凭证流程 | Medium | High | Unit 1b 直接在 plan scope 内实现 SDK 抽象；无迁移期 |
| Kong 移除 master key 注入后旧客户端失败 | High | High | Phase 2 部署前确认所有客户端已切换；Kong 配置可快速回滚 |
| 并发 reconcile 导致重复扣费 | Low | Medium | spend_reconciliation_ledger 表按 spend log ID 去重 |
| 删除 proxy 后遗留引用 | Low | Low | typecheck + 全量测试覆盖 |
| Phase 1-3 双倍计费窗口 | High | High | `RECONCILIATION_ENABLED` feature flag，Phase 3 部署后才启用 |
| BYOK passthrough 收入丢失 | Medium | Low | 弃用 BYOK 模式，用户迁移到虚拟 key。已知 tradeoff |
| LiteLLM spend API 粒度不足 | Medium | High | Unit 3 前验证 API response format，必要时改为差量对账模式 |
| Sandbox 持有 Aether master 工具 key | Medium | Medium | 全局 key 注入所有 sandbox，依赖容器隔离。后续可改为按账户 secret store |
| Phase 3 后回滚需完整 Aether 回滚 | Medium | Medium | Phase 3 后 Kong 回滚不够，需蓝绿部署回滚 Aether |

## Phased Delivery

### Phase 1 — Credential + Billing (可独立上线)
- Unit 1: Credential issuance endpoint
- Unit 2: LiteLLM config
- Unit 3: Billing reconciliation cron

**Deliverable:** 客户端可通过新端点获取 LiteLLM key 并直连。计费正常工作。

### Phase 2 — Kong Routing (需更新 Kong 配置)
- Unit 5: Kong routing

**Deliverable:** `/llm/*` 路由可用。`/v1/control/*` 路由可用。`/v1/chat/completions` 改为虚拟 key 认证。

### Phase 3 — Cleanup (代码清理，无功能变更)
- Unit 6: Remove LLM proxy code
- Unit 7: Remove sandbox preview proxy

**Deliverable:** Aether 代码量显著减少，所有数据面代理代码已清除。

### Phase 4 — Tool Proxy (可最后执行)
- Unit 4: Sandbox secret provisioning
- Unit 8: Replace tool proxy

**Deliverable:** 工具 key 不再经过 Aether proxy，sandbox 直连工具服务。

## Operational / Rollout Notes

1. **部署顺序:** Phase 1 → Phase 2 → Phase 3 → Phase 4。每个 Phase 可独立部署。
2. **Kong 变更需要:** 运行 `ops/sync-kong.sh` 更新路由配置。
3. **LiteLLM 需要先升级:** 确保 LiteLLM 版本支持 `/global/spend/logs` API 和虚拟 key budget 管理。
4. **Kong 变更是破坏性的:** 移除 master key 注入后，所有不带虚拟 key 的请求会失败。确保所有客户端（web、sandbox）已切换到新凭证流程后再部署 Kong 变更。
5. **监控重点:**
   - Spend reconciler 的扣费金额 vs LiteLLM 原始 spend（应匹配）
   - 虚拟 key 的 max_budget 是否及时同步
   - Kong `/llm/*` 路由的延迟和错误率
6. **回滚策略:** Kong 配置可回滚到 master key 注入模式。Aether 保留 proxy 代码直到 Phase 3 完成后再删除。

## Sources & References

- Architecture discussion: 本 session 的 control/data plane 对话
- Memory file: `memory/architecture-control-data-plane.md`
- Related code: `apps/api/src/router/services/litellm-keys.ts`（虚拟 key 基础设施）
- Related code: `apps/api/src/router/config/proxy-services.ts`（当前 proxy 注册表）
- Related config: `scripts/deploy/core/kong.yml`（Kong 路由配置）
- Related config: `infra/litellm/config.yaml`（LiteLLM 模型配置）

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | issues_found | score: 4/10 → 7/10, TTHW: ~5min → ~2min |
| Outside Voice 1 | Claude adversarial subagent | Independent plan challenge | 1 | issues_found | 5 critical blockers found and fixed |
| Eng Review | `/plan-eng-review` | Architecture, code, tests, perf review | 1 | issues_found | 8 issues (arch 5, code 1, tests 1, perf 1) |
| Outside Voice 2 | Claude adversarial subagent (Opus) | Second independent challenge | 1 | issues_found | 12 findings (4 CRITICAL, 4 HIGH, 4 MEDIUM) |

**OUTSIDE VOICE 1:** 5 critical blockers: phantom `/aether/secrets` API, env injection conflict, billing signature mismatch, Kong config has no Aether API service, WebSocket proxy missing from Unit 7. All fixed.

**OUTSIDE VOICE 2 (Opus):** 12 findings. Key fixes applied:
- D4 clarified: inject global Aether keys, not per-account (Finding 3)
- Unit 3 pre-implementation gate: verify LiteLLM spend API format before coding (Finding 4)
- `RECONCILIATION_ENABLED` feature flag prevents double billing during Phase 1-3 (Finding 5)
- D8 added: BYOK passthrough deprecated, known revenue tradeoff (Finding 9)
- Risk table expanded: 6 new entries (double billing, BYOK loss, spend API granularity, master key exposure, Phase 3 rollback complexity)

**NOT FIXED (accepted as-is):**
- Finding 1 (Kong rewrite underestimated): Unit 5 already lists specific Kong changes; detail level matches plan depth
- Finding 7 (no observability): Monitoring points in Operational Notes section; full metrics pipeline out of scope
- Finding 10 (setInterval vs distributed lock): spend_reconciliation_ledger dedup handles multi-instance; Redis lock is YAGNI for current scale
- Finding 12 (virtual key cache staleness): syncKeyBudget called on each credential request; 5-min cache TTL is acceptable

**UNRESOLVED:** 3 items deferred to implementation (anthropic.ts, litellm-admin, model-pricing cleanup)

**VERDICT:** DX + Eng Review + 2 Outside Voices complete. 21 total findings, all critical blockers fixed. Plan ready for implementation with noted deferred items and LiteLLM spend API verification gate on Unit 3.
