# Aether 项目分析设计文档 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 aether 项目分析设计文档转化为可执行的实施计划，确保每个步骤都是具体的、可测试的、无歧义的。

**Architecture:** 按照设计文档的章节结构,为每个主要部分创建对应的实施任务,每个任务包含具体的步骤、包含代码示例和验证方法和。

**Tech Stack:** Markdown, Git, pnpm, TypeScript

---

## 如述

本计划将 `docs/plans/2026-04-08-aether-project-analysis-design.md` 中的设计转化为详细的实施步骤。

主要工作:
1. 为每个主要章节创建实施任务
2. 每个任务分解为可测试的小步骤
3. 为每个步骤提供具体的代码和命令示例

4. 定义验证方法确保质量

## 文件结构
```
docs/
├── plans/
│   ├── 2026-04-08-aether-project-analysis-design.md (existing design)
│   └── 2026-04-08-aether-project-analysis-implementation-plan.md (this file)
└── superpowers/
    └── plans/
        └── 2026-04-08-aether-project-analysis-implementation-plan.md (this file)
```

---

## Task 1: 前端架构文档

**Files:**
- Modify: `docs/plans/2026-04-08-aether-project-analysis-design.md`
- Test: None (documentation task)

- [x] **Step 1: 添加前端架构详细说明**

在 `docs/plans/2026-04-08-aether-project-analysis-design.md` 中,找到 `### 2.1 Web 应用 (apps/web)` 部分,在其后添加更详细的技术说明:

```markdown
### 2.1 Web 应用 (apps/web)
**技术栈**:
- **框架**: Next.js 15.5.x (App Router, React 18)
- **语言**: TypeScript 5.x
- **样式**: Tailwind CSS 4.x
- **状态管理**: Zustand 5.x
- **数据获取**: TanStack Query 5.75.x
**主要目录结构**:
```
apps/web/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/       # 仪表板页面
│   │   ├── (home)/              # 营销页面
│   │   ├── auth/                # 认证
│   │   └── api/                 # API Routes
│   ├── components/           # 共享组件
│   │   ├── thread/              # Agent 会话 UI
│   │   ├── file-editors/        # 代码编辑器
│   │   ├── billing/            # 计费相关
│   │   └── integrations/      # 第三方集成
│   ├── features/            # 功能模块
│   │   ├── files/              # 文件管理
│   │   └── skills/              # Agent 技能
│   └── public/                  # 静态资源
└── next.config.ts              # Next.js 配置
├── tailwind.config.ts           # Tailwind 配置
```
**关键特性**:
- 完整的仪表板系统(会话、线程、文件管理)
- Agent 会话界面(流式输出)
- 代码编辑器(CodeMirror, Monaco Editor)
- 文件浏览器(支持搜索、历史)
- 计费订阅管理(Stripe)
- 第三方集成管理(Pipedream)
```

- [x] **Step 2: 提交更改**

```bash
git add docs/plans/2026-04-08-aether-project-analysis-design.md
git commit -m "docs: add detailed frontend architecture documentation"
```

---

## Task 2: 后端架构文档
**Files:**
- Modify: `docs/plans/2026-04-08-aether-project-analysis-design.md`
- Test: None (documentation task)

- [x] **Step 1: 添加后端架构详细说明**

在 `docs/plans/2026-04-08-aether-project-analysis-design.md` 中,找到 `### 3.1 技术栈` 部分,在其后添加更详细的技术说明
```markdown
### 3.1 技术栈
**核心框架**:
- **运行时**: Bun (高性能 JavaScript 运行时)
- **Web 框架**: Hono (轻量级 Web 框架)
**语言**: TypeScript 5.x
**主要模块**:
```
apps/api/src/
├── router/              # AI 模型路由
├── billing/             # 计费系统
│   ├── credits.ts          # 积分管理
│   ├── subscriptions.ts   # 订阅管理
│   └── webhooks.ts         # Stripe Webhooks
├── platform/             # 沙箱管理
│   ├── sandbox-provisioner.ts
│   ├── sandbox-health.ts
│   └── sandbox-backups.ts
├── cron/                # 定时任务
├── tunnel/               # 隧道系统
│   ├── connections.ts      # 连接管理
│   └── permissions.ts     # 权限控制
├── integrations/          # 第三方集成
├── sandbox-proxy/         # 沙箱代理
└── admin/                # 管理后台
```
**主要端点组**:
```
/v1/
├── router/              # AI 路由
│   ├── /v1/chat/completions  # 聊天补全
│   └── /v1/models           # 模型列表
├── billing/              # 计费
│   ├── /v1/billing/credits
│   ├── /v1/billing/subscriptions
│   └── /v1/billing/webhooks/stripe
├── platform/              # 平台
│   ├── /v1/platform/sandboxes
│   ├── /v1/platform/sandbox/:sandboxId
│   └── /v1/platform/servers
├── tunnel/                # 隧道
│   ├── /v1/tunnel/connections
│   ├── /v1/tunnel/permissions
│   └── /v1/tunnel/device-auth
└── integrations/             # 集成
    └── /v1/integrations/pipedream
```
**AI SDK 集成**:
- `@ai-sdk/anthropic` - Claude
- `@ai-sdk/openai` - OpenAI
- `@ai-sdk/google` - Gemini
- `@ai-sdk/xai` - xAI
```

- [x] **Step 2: 提交更改**

```bash
git add docs/plans/2026-04-08-aether-project-analysis-design.md
git commit -m "docs: add detailed backend architecture documentation"
```

---

## Task 3: 数据库架构文档
**Files:**
- Modify: `docs/plans/2026-04-08-aether-project-analysis-design.md`
- Test: None (documentation task)

- [x] **Step 1: 添加数据库架构详细说明**

在 `docs/plans/2026-04-08-aether-project-analysis-design.md` 中,找到 `### 4.1 技术选型` 部分,在其后添加更详细的技术说明
```markdown
### 4.1 技术选型
**数据库**: PostgreSQL
**托管**: Supabase Cloud / Self-hosted
**ORM**: Drizzle ORM 0.44.x
**连接**: 连接池, Supabase client
**Schema 设计原则**:
- 使用 `acme` schema 分离业务数据
- 使用 `public` schema 存储认证数据
- 所有表都有适当的索引
- 使用 Drizzle 的类型安全查询

**主要表结构**:
```typescript
// 核心表
sandboxes         // AI 沙箱实例
accounts         // 账户(组织)
account_members  // 账户成员
deployments       // 部署记录
api_keys          // API 密钥
integrations      // 第三方集成

// 计费表
credit_accounts   // 积分账户
credit_ledger     // 积分账本
billing_customers // 计费客户

// 隧道表
tunnel_connections    // 隧道连接
tunnel_permissions    // 隧道权限
```
```

- [x] **Step 2: 提交更改**

```bash
git add docs/plans/2026-04-08-aether-project-analysis-design.md
git commit -m "docs: add detailed database architecture documentation"
```
