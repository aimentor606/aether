# Draft: Aether 整合实施计划

## 状态: ALL QUESTIONS RESOLVED — 准备呈现完整设计

---

## Requirements (全部确认 ✅)

- **执行顺序**: 后端优先，UI 延后 2 周启动
- **变更处理**: 先提交当前 32 文件变更，建立稳定基线
- **整合方案**: 方案 B — 流水线并行 (10-12 周)
- **核心策略**: Single Codebase Multi-Tenant，垂直包从 `packages/vertical/*` 拆为顶层独立包
- **UI 策略**: 完全自主，不同步上游 UI；LiteLLM 管理界面重写
- **品牌名称**: ✅ **Aether** — P0 阶段统一处理 acme → aether rename
- **品牌标识**: ✅ 暂时用 Placeholder（文字 Logo + 通用主题色）
- **域名**: ✅ 已有域名
- **包命名空间**: ✅ 统一 `@aether/*`
- **垂直行业优先级**: ✅ Finance 优先
- **部署目标**: ✅ 混合部署 — Vercel (前端) + 自托管 Docker (后端)
- **测试基础设施**: ✅ 无现有基础设施，P0 阶段搭建
- **CI/CD**: ✅ GitHub Actions
- **Supabase**: ✅ 先 Cloud，后续可切 Self-hosted
- **A2UI**: ✅ 已有骨架代码，基于 v0.8 stable 继续开发
- **范围排除**: Mobile App 不动、Agent Tunnel 不动
- **范围包含**: Voice 模块保留（不在本次重构范围但保留代码）
- **品牌迁移时机**: ✅ P0 阶段统一处理

## Technical Decisions

- **垂直包路径**: 顶层 `packages/finance|healthcare|retail/`
- **UI 组件库**: `packages/ui/` — shadcn/ui + TanStack Table + Recharts
- **SDK**: `packages/sdk/` — auth/api/realtime/a2ui/llm
- **DB**: Supabase Cloud + RLS 策略
- **LLM 网关**: LiteLLM Proxy
- **Agent 运行时**: OpenCode
- **品牌迁移**: P0 阶段统一 acme → aether
- **测试框架**: P0 搭建（vitest 或 bun test，待定）
- **品牌标识**: Placeholder（文字 Logo + 通用色），后续请设计师

## 阶段划分 (已确认)

### 后端流水线 (7 阶段)

| 阶段 | 名称 | 工期 | 依赖 | 核心交付 |
|------|------|------|------|---------|
| P0 | 基线稳定 + 品牌迁移 | W1 | 无 | 提交变更 + acme→aether rename + 测试框架 + build 通过 |
| P1 | 垂直包固化 | W1-W2 | P0 | 垂直包迁移完成，DB schema + migration |
| P2 | 多租户中间件 | W2-W3 | P1 | Config Loader + Feature Flags + Tenant Context |
| P3 | Finance API + 集成 | W3-W4 | P2 | Finance API routes + 外部集成适配器 |
| P4 | 测试 + QA | W4-W5 | P3 | 单元/集成/E2E 测试 |
| P5 | 部署流水线 | W5-W6 | P4 | CI/CD + Docker (后端) + Vercel (前端) + staging |
| P6 | 上线准备 | W6-W8+ | P5 | 灰度、监控、文档 |

### UI 流水线 (6 阶段)

| 阶段 | 名称 | 工期 | 依赖 | 核心交付 |
|------|------|------|------|---------|
| U1 | SDK 层 | W3-W4 | P2 | auth/api/realtime/a2ui/llm |
| U2 | 基础组件 + 布局 | W4-W5 | U1 | 30 primitives + AppShell/Sidebar |
| U3 | Chat + A2UI | W5-W6 | U2 | Chat + A2UI Renderer + Basic Catalog |
| U4 | Admin 重写 | W6-W7 | U3 | LiteLLM 管理 + 平台管理 + 计费 |
| U5 | 行业组件 | W7-W9 | U3+P3 | Finance 组件 + Catalog |
| U6 | apps/web 瘦身 | W9-W10 | U5 | 依赖 233→~120 |

## Scope Boundaries
- **INCLUDE**: 后端多租户、垂直包(Finance优先)、UI组件库、SDK、LiteLLM管理、品牌迁移、测试框架、CI/CD
- **EXCLUDE**: Mobile App (不动)、Agent Tunnel (不动)、Voice (保留不重构)
- **DEFERRED**: Healthcare/Retail 垂直行业详细实施、Self-hosted Supabase 迁移、品牌视觉设计

## Research Findings
- 垂直包路径已从 `packages/vertical/*` 迁移到顶层 `packages/finance|healthcare|retail`
- `packages/ui` 和 `packages/sdk` 骨架已创建（含 A2UI 骨架代码）
- `packages/db` 已新增 `finance.ts` schema
- `apps/api` 已新增 `verticals/` 和 `routes/finance/`
- 大量 Aether 品牌引用存在于代码中（P0 统一替换为 Aether）
- apps/web 有大量 TS 编译错误（模块找不到），说明当前工作区不可构建 — P0 需要修复
