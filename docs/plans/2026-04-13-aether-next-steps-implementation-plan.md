# Aether 下一步实施计划

**日期**: 2026-04-13
**状态**: Ready for Execution
**参考文档**:
- UI 设计: `docs/plans/2026-04-13-unified-ui-architecture-design.md` (Approved)
- SaaS 架构: `docs/plans/2026-04-12-aether-saas-product-strategy-design.md` (Approved)
- Fork 策略: `docs/plans/2026-04-09-vertical-saas-fork-design.md` (Approved)

---

## 0. 策略：两条线并行

```
线 A: 后端 SaaS 架构          线 B: 前端 UI 重构
─────────────────────        ─────────────────────
A1. Rebrand 脚本              B1. 3D 依赖清理
A2. DB Schema 迁移            B2. SDK client/server 拆分
A3. 多租户中间件              B3. Primitives 组件补充
A4. Finance API 完善          B4. Chat + A2UI 组件
                              B5. Finance UI 组件
         ↓ 交叉 ↓
    A5. Finance 端到端联调
    A6. LiteLLM 管理界面 (需 B 完成)
```

---

## 1. 后端 SaaS 架构 (Line A)

### A1. Rebrand Codemod 脚本

**优先级**: 高（阻塞后续品牌统一）
**预估**: 4-6 小时

**审计发现**:
- Aether: 1,472 occurrences / 250 files
- Aether: 491 occurrences / 86 files
- Suna: 33 occurrences / 13 files
- 文件名: 36 个需重命名

**任务**:

- [ ] 创建 `scripts/rebrand.config.json` — 品牌常量映射
  ```json
  {
    "BRAND_NAME": "aether",
    "BRAND_DISPLAY": "Aether",
    "OLD_BRANDS": {
      "acme": { "display": "Aether", "packageScope": "@acme" },
      "aether": { "display": "Aether" },
      "suna": { "display": "Suna" }
    },
    "SKIP_PATTERNS": ["node_modules", ".git", "pnpm-lock.yaml", "*.lock", "dist/"]
  }
  ```
- [ ] 创建 `scripts/rebrand.sh` — 幂等品牌替换脚本
  - 替换包名 `@acme/*` → `@aether/*`（所有 package.json + import 语句）
  - 替换环境变量 `ACME_*` → `AETHER_*`
  - 替换 HTTP header `X-Aether-Token` → `X-Aether-Token`
  - 替换 cookie 名 `ACME_SUPABASE_AUTH_COOKIE` → `AETHER_SUPABASE_AUTH_COOKIE`
  - 替换用户可见文字
  - **不替换**: API key 前缀（`acme_*` 需要独立迁移，见 A1.2）
  - **不替换**: DB schema 名（需要 DB migration）
  - 重命名文件名含 `acme-` 的文件
- [ ] A1.2: API Key 前缀迁移策略
  - `apps/api/src/shared/crypto.ts` 中 `acme_`, `acme_sb_`, `acme_tnl_` 前缀
  - 新 key 用 `aether_` 前缀
  - 旧 key 保持兼容（验证时同时检查新旧前缀）
  - 添加过渡期标志 `AETHER_LEGACY_KEY_PREFIXES=true`
- [ ] 运行脚本 + 验证
  ```bash
  BRAND=aether bash scripts/rebrand.sh
  pnpm install
  pnpm build
  ```

**验收标准**:
- [ ] `grep -ri "acme" --include="*.ts" --include="*.tsx" apps/ packages/ | grep -v node_modules | wc -l` < 20（剩余仅为注释或兼容代码）
- [ ] `pnpm build` 通过
- [ ] 所有 `@acme/*` import 已替换为 `@aether/*`

---

### A2. DB Schema 迁移

**优先级**: 高（阻塞 A3、A4）
**预估**: 1 天
**依赖**: 无

**任务**:

- [ ] 新增 `packages/db/src/schema/vertical-config.ts`
  ```typescript
  // 表: feature_flags, vertical_configs, account_integrations
  // 参考: docs/plans/2026-04-12-aether-saas-implementation-plan.md Phase 1.4
  ```
- [ ] 更新 `packages/db/src/schema/index.ts` — 导出新表
- [ ] 更新 `packages/db/src/types.ts` — 新增类型定义
- [ ] 生成 Drizzle migration
  ```bash
  cd packages/db && pnpm drizzle-kit generate
  ```
- [ ] 更新 `packages/db/src/index.ts` — 导出新 schema

**验收标准**:
- [ ] `pnpm drizzle-kit push` 成功创建 3 张新表
- [ ] TypeScript 编译无错误
- [ ] 新表的 relations 正确定义

---

### A3. 多租户中间件

**优先级**: 中
**预估**: 2-3 天
**依赖**: A2

**任务**:

- [ ] 创建 `apps/api/src/middleware/tenant-context.ts`
  - AsyncLocalStorage 存储当前请求的 tenantId, accountId, sandboxId, userId
  - 从 JWT 或 API key 解析租户信息
- [ ] 创建 `apps/api/src/middleware/tenant-config-loader.ts`
  - 从 `vertical_configs` 表加载租户配置
  - 从 `feature_flags` 表加载功能开关
  - 缓存策略: 内存 LRU + TTL 5min
- [ ] 更新 `apps/api/src/index.ts` — 注册中间件
- [ ] 更新 `apps/api/src/router/index.ts` — 在路由前注入租户上下文

**验收标准**:
- [ ] 每个 API 请求自动附带租户上下文
- [ ] 无租户信息的请求返回 401
- [ ] Feature flags 可按租户动态开关

---

### A4. Finance Vertical API 完善

**优先级**: 中
**预估**: 2 天
**依赖**: A2

**当前状态**: `apps/api/src/router/routes/finance/` 有骨架文件 (budgets, expenses, invoices, ledgers, index)，`apps/api/src/verticals/` 有 config/db/index/routes/services/middleware 目录。

**任务**:

- [ ] 完善 Finance routes CRUD
  - `budgets.ts` — 预算 CRUD + 超支预警
  - `expenses.ts` — 费用录入 + 分类统计
  - `invoices.ts` — 发票生成 + 状态流转
  - `ledgers.ts` — 分户账 + 余额查询
- [ ] 实现 `apps/api/src/verticals/services/finance-service.ts`
  - 业务逻辑层，调用 `packages/finance/` 的后端模块
- [ ] 集成多租户中间件（A3 完成后）
  - 所有 Finance 路由自动 scope 到当前租户

**验收标准**:
- [ ] Finance API 路由可通过 `curl` 测试 CRUD
- [ ] 数据按 accountId 隔离
- [ ] Schema 校验使用 Zod

---

## 2. 前端 UI 重构 (Line B)

### B1. 3D/图形库依赖清理

**优先级**: 高（立即可做）
**预估**: 2-3 小时
**依赖**: 无

**审计结论**:

| 库 | 使用状态 | 操作 |
|---|---|---|
| `konva` + `react-konva` | **完全未使用** — 0 import | 删除 |
| `ogl` | 仅用于 2 个死代码组件 | 删除组件 + 删除依赖 |
| `@react-three/drei` | 仅 landing variant-2 + 死代码 | 保留（landing 需要三） |
| `@react-three/fiber` | 同上 | 保留 |
| `three` + `@types/three` | 同上 | 保留 |
| `cobe` | Globe 组件导出但从未渲染 | 删除 globe.tsx + 依赖 |

**任务**:

- [ ] 删除 `apps/web/src/components/ui/prismatic-burst.tsx` (ogl, 死代码)
- [ ] 删除 `apps/web/src/components/ui/light-rays.tsx` (ogl, 死代码)
- [ ] 删除 `apps/web/src/components/ui/globe.tsx` (cobe, 未渲染)
- [ ] 删除 `apps/web/src/components/instance/acme-box-display.tsx` (three, 死代码)
- [ ] 清理 `globe-region-picker.tsx` — 移除 globe 相关代码，保留 RegionToggle
- [ ] 从 `apps/web/package.json` 移除: `konva`, `react-konva`, `ogl`, `cobe`
- [ ] `pnpm install` + 验证 build

**验收标准**:
- [ ] `pnpm build` 通过
- [ ] 减少 4 个直接依赖 + 若干传递依赖
- [ ] `grep -r "konva\|ogl\|cobe" apps/web/src/` 仅剩注释

---

### B2. SDK client/server 拆分

**优先级**: 高
**预估**: 1-2 天
**依赖**: 无

**当前问题**:
- `packages/sdk/package.json` 列了 `react`, `@tanstack/react-query`, `zustand` 为运行时依赖
- 但只有 `a2ui/catalog.ts` 和 `a2ui/types.ts` 使用 React
- `auth/`, `api/`, `realtime/`, `llm/` 全部是纯 TypeScript

**任务**:

- [ ] 重构 SDK exports 结构:
  ```json
  {
    "exports": {
      ".": "./src/index.ts",
      "./auth": "./src/auth/index.ts",
      "./api": "./src/api/index.ts",
      "./realtime": "./src/realtime/index.ts",
      "./llm": "./src/llm/index.ts",
      "./a2ui": "./src/a2ui/index.ts",
      "./a2ui/catalog": "./src/a2ui/catalog.ts",
      "./client": "./src/client/index.ts",
      "./server": "./src/server/index.ts"
    }
  }
  ```
- [ ] 创建 `packages/sdk/src/client/` — React 专用
  - `hooks/` — React Query hooks（从 apps/web 迁移）
  - `providers/` — React Context providers
- [ ] 创建 `packages/sdk/src/server/` — Node 专用
  - `supabase-admin.ts`（从 apps/web/src/lib/supabase/server.ts 迁移）
  - `api-helpers.ts`
- [ ] 解耦 a2ui/catalog 的 React 依赖
  - `types.ts` 中 `React.ComponentType` → `unknown` 或泛型
  - catalog 类型定义移到 SDK，具体 React 组件映射留在 `packages/ui`
- [ ] 迁移核心 SDK 模块（从 apps/web 补全功能）:
  - `sdk/api/client.ts` ← 吸收 `apps/web/src/lib/api-client.ts` 的完整功能
  - `sdk/auth/` ← 吸收 `apps/web/src/lib/auth-token.ts` 的 token 管理
  - `sdk/realtime/` ← 吸收 `apps/web/src/lib/utils/sse-stream.ts` 的 SSE 增强
- [ ] 迁移共享的 JWT 验证: `apps/api/src/shared/jwt-verify.ts` → `sdk/auth/jwt-verify.ts`
- [ ] 更新 `package.json` — React 移到 peerDependencies

**验收标准**:
- [ ] `import { createApiClient } from '@aether/sdk/api'` 可在 Node 环境使用（无 React）
- [ ] `import { useSession } from '@aether/sdk/client'` 可在 React 组件使用
- [ ] SDK 的核心模块（auth, api, realtime, llm, a2ui/parser）无 React 依赖
- [ ] `pnpm build` 通过

---

### B3. Primitives 组件补充

**优先级**: 中
**预估**: 1 天
**依赖**: 无

**当前状态**: `packages/ui/src/primitives/` 已有 17 个组件:
badge, button, card, checkbox, dialog, input, label, progress, scroll-area, select, separator, skeleton, switch, table, tabs, textarea, tooltip

**目标**: 补充到 ~30 个核心组件

**待补充组件**:

| 组件 | 用途 | Radix 依赖 |
|---|---|---|
| `alert-dialog.tsx` | 确认对话框 | `@radix-ui/react-alert-dialog` (已有) |
| `accordion.tsx` | 折叠面板 | `@radix-ui/react-accordion` (已有) |
| `avatar.tsx` | 用户头像 | `@radix-ui/react-avatar` (已有) |
| `collapsible.tsx` | 可折叠区域 | `@radix-ui/react-collapsible` (已有) |
| `context-menu.tsx` | 右键菜单 | `@radix-ui/react-context-menu` (已有) |
| `dropdown-menu.tsx` | 下拉菜单 | `@radix-ui/react-dropdown-menu` (已有) |
| `form.tsx` | 表单组件 | react-hook-form (已有) |
| `navigation-menu.tsx` | 导航菜单 | `@radix-ui/react-navigation-menu` (已有) |
| `popover.tsx` | 弹出框 | `@radix-ui/react-popover` (已有) |
| `radio-group.tsx` | 单选组 | `@radix-ui/react-radio-group` (已有) |
| `slider.tsx` | 滑块 | `@radix-ui/react-slider` (已有) |
| `toggle.tsx` | 切换按钮 | `@radix-ui/react-toggle` (已有) |
| `command.tsx` | 命令面板 | cmdk (已有) |

**注意**: 所有 Radix 依赖已在 `packages/ui/package.json` 中声明，无需新增。

**任务**:

- [ ] 创建 13 个 primitive 组件（遵循 shadcn/ui 标准）
- [ ] 更新 `primitives/index.ts` 导出
- [ ] 添加基础 Storybook stories（如有）

**验收标准**:
- [ ] primitives/ 目录包含 30 个组件文件
- [ ] 每个组件有正确的 TypeScript 类型导出
- [ ] `pnpm build` 通过

---

### B4. Chat + A2UI 组件

**优先级**: 中
**预估**: 3-4 天
**依赖**: B2 (SDK), B3 (Primitives)

**任务**:

- [ ] `packages/ui/src/chat/` 组件迁移
  - `chat-container.tsx` ← 从 apps/web 迁移
  - `message-list.tsx`
  - `message-bubble.tsx`
  - `chat-input.tsx`
  - `tool-renderer.tsx` — Agent 工具调用结果渲染
  - `pty-terminal.tsx` — PTY 终端嵌入
  - `model-selector.tsx` — LLM 模型选择器
- [ ] `packages/ui/src/a2ui/` 渲染器实现
  - `renderer.tsx` — A2UI Block 渲染器
  - `surface.tsx` — A2UI Surface 容器
  - `catalog/basic.tsx` — 基础 Catalog (Text, Card, Table, Form)
  - `hooks/use-a2ui-stream.ts` — 流式解析 hook
  - `hooks/use-a2ui-actions.ts` — 用户动作 hook
- [ ] 集成测试: Chat 组件 + A2UI Surface 联调

**验收标准**:
- [ ] Chat 组件可在独立页面渲染
- [ ] A2UI Renderer 可解析 v0.8 协议的 JSONL 流
- [ ] Basic Catalog 至少支持 Text, Card, Table, Form 四种 Block

---

### B5. Finance UI 组件

**优先级**: 中
**预估**: 2-3 天
**依赖**: B3 (Primitives), B4 (Chat/A2UI 的 Catalog 基础)
**与后端对齐**: A4 (Finance API)

**任务**:

- [ ] `packages/ui/src/vertical/finance/` 组件
  - `transaction-panel.tsx` — 交易列表 + 筛选
  - `risk-dashboard.tsx` — 风险仪表盘（Recharts）
  - `invoice-builder.tsx` — 发票编辑器
  - `budget-overview.tsx` — 预算概览卡片
- [ ] `packages/ui/src/a2ui/catalog/finance.tsx` — 金融行业 A2UI Catalog
  - 扩展 Basic Catalog
  - 添加 Finance 特有组件映射（TransactionTable, InvoiceCard 等）
- [ ] 与 Finance API 联调（需要 A4 完成）

**验收标准**:
- [ ] Finance 组件可在 `/finance/*` 路由下渲染
- [ ] A2UI Finance Catalog 包含至少 5 个行业组件映射
- [ ] 与后端 API 联调通过

---

## 3. 依赖关系总览

```
B1 (3D清理) ─── 无依赖，立即可开始
B2 (SDK拆分) ── 无依赖，立即可开始
B3 (Primitives) ─ 无依赖，立即可开始

A1 (Rebrand) ── 无依赖，立即可开始
A2 (DB Schema) ─ 无依赖，立即可开始

B4 (Chat/A2UI) ── 依赖 B2 + B3
A3 (多租户) ──── 依赖 A2
A4 (Finance API) ─ 依赖 A2

B5 (Finance UI) ── 依赖 B3 + B4 + A4
```

## 4. 执行时间线

```
Week 1:
  Day 1-2: A1 (Rebrand) + B1 (3D清理) + B2开始(SDK拆分)
  Day 3-4: B2完成 + B3 (Primitives) + A2 (DB Schema)
  Day 5:   集成验证

Week 2:
  Day 1-3: A3 (多租户) + B4 (Chat/A2UI)
  Day 4-5: A4 (Finance API) + B5开始(Finance UI)

Week 3:
  Day 1-3: B5完成 + A5 (Finance 端到端联调)
  Day 4-5: Bug 修复 + 文档更新
```

## 5. 验收总清单

- [ ] Rebrand: Aether/Aether/Suna 引用 < 20 处
- [ ] DB: 3 张新表创建成功，migration 可回滚
- [ ] 多租户: API 请求自动附带租户上下文
- [ ] Finance API: CRUD 路由 + 数据隔离
- [ ] 3D清理: 4+ 依赖删除，build 通过
- [ ] SDK: client/server 分层，核心模块无 React
- [ ] Primitives: 30 个组件就绪
- [ ] Chat/A2UI: 可渲染 Agent 对话 + A2UI 流
- [ ] Finance UI: 行业组件 + A2UI Catalog

---

## 附录 A: 不在本阶段范围内的任务

| 任务 | 原因 | 计划阶段 |
|---|---|---|
| OpenSandbox 集成 | 等待决策 | Phase 2 |
| Agent 能力增强 | 独立工作流 | 与 Phase 3 并行 |
| Admin 重写 (LiteLLM UI) | 依赖 SDK + Primitives | UI Phase 4 |
| Healthcare/Retail UI | 依赖 Finance 模式验证 | UI Phase 5 |
| apps/web 瘦身 | 依赖组件迁移完成 | UI Phase 6 |

## 附录 B: Rebrand 风险评估

| 类别 | 数量 | 风险 | 处理策略 |
|---|---|---|---|
| 包名 `@acme/*` | ~177 | 低 — 机械替换 | 脚本自动处理 |
| 环境变量 `ACME_*` | ~407 | 中 — 需要部署协调 | 新名优先，旧名兼容 |
| API key 前缀 `acme_*` | ~257 | **高** — DB 中有哈希值 | 新 key 用新前缀，旧 key 兼容验证 |
| HTTP headers | ~38 | 中 — API 契约变更 | 双写过渡期 |
| Cookie 名 | ~21 | 中 — 会话失效 | 强制重新登录 |
| DB schema/index | ~8 | **高** — 需要 migration | 独立 migration PR |
| 用户可见文字 | ~709 | 低 — 纯展示 | 脚本处理 |
| 文件名 | ~36 | 低 | git mv |
