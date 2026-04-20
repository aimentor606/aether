# Aether (Aether) 项目技术架构分析报告

## 文档信息

| **日期**: 2026-04-08
| **版本**: 1.0
| **作者**: Claude (AI Assistant)
| **状态**: 草稿

---

## 1. 项目概览

### 1.1 产品定位

**Aether** 是一个 **AI 自主公司操作系统 (Autonomous Company Operating System) — 一个云电脑，其上运行着 AI Agent 24/7 处理各种业务任务。

### 1.2 核心理念
- **Everything Is files**: 以 Markdown 为基础，代码可读、可跟踪
- **Memory over repetition**: 4层持久化内存系统，- **Compounding workforce**: 可扩展的 Agent 体系

### 1.3 技术架构

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Web App (Next.js) │  │  Mobile App (Expo) │  │  Dashboard/Chat UI │  │
│  └──────────────┘  └────────────────────┘
│                                   │
│                            API Gateway (Hono/Bun)
│                            ▼
│        ┌───────────────────────────────────────────────────┐
│            Backend Services                      │
│  ├───────────────────────────────────────────┤
│  │  Router (AI model routing)                     │
│  │  Billing (Stripe)                     │
│  │  Platform (Sandbox management)                   │
│  │  Cron (Scheduled tasks)                          │
│  │  Tunnel (Remote connections)              │
│  │  Integrations (Pipedream)                  │
└───────────────────────────────────────────────────┘
│                            │
│         Infrastructure Layer           │
│  ├───────────────────────────────────────────┤
│  │  PostgreSQL (Supabase)           │
│  │  Redis (caching)               │
│  │  Docker (Sandbox containers)  │
│  │  Drizzle ORM                  │
└───────────────────────────────────────────────────┘
│                            │
│          Agent Runtime Layer          │
│  ├───────────────────────────────────────────┤
│  │  OpenCode framework          │
│  │  7 specialized agents        │
│  │  12+ skills                  │
│  │  4-tier memory system       │
│  │  Channel integrations        │
│    (Slack, Telegram, etc.)   │
└───────────────────────────────────────────────────┘
```

---

## 2. Frontend 枀 练架构

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
- 完整的仪表板系统（会话、线程、文件管理)
- Agent 会话界面(流式输出)
- 代码编辑器(CodeMirror, Monaco Editor)
- 文件浏览器(支持搜索、历史)
- 计费和订阅管理(Stripe)
- 第三方集成管理(Pipedream)

### 5.2 移动应用 (apps/mobile)

**技术栈**:
- **框架**: Expo (React Native)
- **语言**: TypeScript
- **样式**: React Native Styling

**主要功能**:
- 移动端 Agent 交互
- 跨平台会同步

### 5.3 共享包 (packages/)

#### 5.3.1 数据层 (@aether/db)
**技术栈**:
- **ORM**: Drizzle ORM 0.44.x
- **数据库**: PostgreSQL (via Supabase)

**主要功能**:
- 类型安全的数据库访问
- Schema 还移管理
- 数据库连接池

#### 5.3.2 共享工具 (@aether/shared)
**内容**:
- 共享工具函数
- 娡型 Pricing 配置
- 娡型路由配置

### 5.3.3 Agent 鷷道 (packages/agent-tunnel)
用于 Agent 和隧道通信

---

## 3. Backend API (apps/api)

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

### 3.2 API 路由结构

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

### 3.3 AI SDK 集成

**支持的模型提供商**:
- Anthropic (Claude)
- OpenAI (GPT-4, GPT-4.1)
- Google (Gemini)
- xAI (Grok)

**SDK 实现**:
- `@ai-sdk/anthropic` - Claude
- `@ai-sdk/openai` - OpenAI
- `@ai-sdk/google` - Gemini
- `@ai-sdk/xai` - xAI

---

## 4. 数据库设计

### 4.1 技术选型

**数据库**: PostgreSQL
**托管**: Supabase Cloud / Self-hosted
**ORM**: Drizzle ORM 0.44.x
**连接**: 连接池, Supabase client

### 4.2 核心 Schema (数据库)

#### 4.2.1 讲户与认证
**Table**: `auth.users`
**用途**: Supabase 管理的用户认证
**关键字段**:
- `id` (UUID) - 用户 ID
- `email` - 邮箱
- `encrypted_password` - 加密密码
- `created_at` - 创建时间

#### 4.2.2 Aether Schema (`aether`)
**Tables**:
- `accounts` - 账户(组织)
- `account_members` - 账户成员
- `sandboxes` - AI 沙箱实例
- `deployments` - 部署记录
- `api_keys` - API 密钥
- `integrations` - 第三方集成
- `billing_customers` - 计费客户
- `credit_accounts` - 积分账户
- `credit_ledger` - 积分账本
- `tunnel_connections` - 隧道连接
- `tunnel_permissions` - 隧道权限

### 4.3 Schema 关系图

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   accounts   │───────│  account_members  │───────│     users     │
└─────────────┘       └─────────────┘       └─────────────┘
        │                           │
        │                           ▼
┌─────────────┐       └─────────────┐
│  sandboxes   │───────│  deployments  │
└─────────────┘       └─────────────┘
        │
        ▼
┌─────────────┐       └─────────────┐
│  accounts   │───────│   sandboxes   │
└─────────────┘       └─────────────┘
```

### 4.4 粙箱状态机

**状态**: `provisioning` | `active` | `stopped` | `archived` | `pooled` | `error`
**状态转换**:
- provisioning → active (沙箱创建成功)
- active -> stopped (用户停止)
- stopped -> archived (归档)
- pooled (资源池中待复用)

---

## 5. Agent 运行时系统

### 5.1 核心架构

**运行环境**: Docker 容器 (Ubuntu + KDE Desktop)
**框架**: OpenCode (AI Agent Framework)
**持久化**: `/workspace/` Docker volume

### 5.2 Agent 系统

#### 5.2.1 主 Agent (柯塔克斯)
**名称**: Aether
**模式**: primary
**职责**:
- 任务理解与执行
- Agent 协调与管理
- 文件系统操作
- 代码开发与执行

**权限**:
- 所有工具默认允许
- Agent 生成/管理
- Cron/Event 触发

#### 5.2.2 Worker Agent
**名称**: General Knowledge Worker
**模式**: worker
**职责**:
- 后台任务处理
- 并行工作
- 长时间运行的任务

### 5.3 技能系统

**Categories**:
- 文档处理 (DOCX, PDF, XLSX)
- 内容创作 (演示文稿、视频)
- 線上研究 (网络搜索、网页抓取)
- 通信 (邮件、社交媒体)
- 开发工具 (API, 代码生成)

**技能示例**:
- `deep-research` - 深度研究
- `docx` - Word 文档
- `pptx` - PowerPoint
- `remotion` - 视频制作
- `elevenlabs` - 文本转语音
- `browser-automation` - 浏览器自动化

### 5.4 4 层内存系统

```
┌─────────────────────────────────────────────────────────────┐
│                  Memory Architecture                    │
├─────────────────────────────────────────────────────────────┤
│                                                      │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│   │  Core    │    │  Long-   │    │ Episodic  │    │Knowledge │
│   │  Memory  │    │  term    │    │  Memory   │    │   Base   │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘
│                                                      │
│   每次会话加载      按需检索         会话日志            参考资料       │
│   (Who/What/How)    按需检索          吜索              │
│                                                      │
└─────────────────────────────────────────────────────────────┘
```

**内存类型**:

#### 5.4.1 Core Memory (核心内存)
**位置**: `/workspace/.aether/memory/core/`
**加载**: 每次会话自动加载
**内容**:
- Agent 身份和使命
- 用户偏好
- 当前项目上下文
- 重要决策记录

#### 5.4.2 Long-term Memory (长期记忆)
**位置**: `/workspace/.aether/memory/long-term/`
**访问**: 按需检索
**内容**:
- 用户信息
- 联系人
- 学习和经验
- 持久化偏好

#### 5.4.3 Episodic Memory (情景记忆)
**位置**: `/workspace/.aether/memory/episodic/`
**格式**: 会话日志
**内容**:
- 会话历史
- 交互记录
- 工具调用日志

#### 5.4.4 Knowledge Base (知识库)
**位置**: `/workspace/.aether/knowledge/`
**用途**: 参考资料
**内容**:
- 研究报告
- 文档
- 代码片段
- 最佳实践

---

## 6. 核心业务流程

### 6.1 用户认证流程

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│  用户    │────▶│  Supabase   │────▶│  Session    │
│  请求   │     │  Auth       │     │  Token      │
└─────────┘     └──────────────┘     └─────────────┘
                                            │
                    ┌───────────────┐
                    │  API Gateway   │
                    │  (Hono)        │
                    └───────────────┘
                            │
            ┌───────────────┴───────────────┬
            │  路由到各服务模块 │
            └───────────────┴───────────────┘
                            │
        ┌─────────┬──────────┬──────────┬
        │  Router  │ Platform │  Billing  │ ...
        └─────────┴──────────┴──────────┘
```

**步骤**:
1. 用户通过 Supabase Auth 登录
2. 获取 Session Token (JWT)
3. 请求携带 Token 访问 API
4. API 验证 Token 并提取用户信息
5. 路由到对应的服务模块

### 6.2 Agent 会话流程

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│  用户    │────▶│  Frontend    │────▶│  API        │
│  请求   │     │  (WebSocket)  │     │  Router    │
└─────────┘     └──────────────┘     └─────────────┘
                                            │
                    ┌───────────────┐
                    │  模型提供商   │
                    │  (Anthropic) │
                    └───────────────┘
                            │
                    ┌───────────────┐
                    │  Agent 执行  │
                    │  (Docker)     │
                    └───────────────┘
                            │
                    ┌───────────────┐
                    │  响应流返回  │
                    └───────────────┘
```

**步骤**:
1. 用户在 Frontend 发起对话
2. 请求通过 WebSocket 发送到 API
3. API Router 选择合适的模型
4. 流式请求发送到模型提供商
5. 娡型响应流式返回
6. 寏个 chunk 通过 WebSocket 发送到 Frontend

### 6.3 沙箱管理流程

```
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│  用户    │────▶│  Platform    │────▶│  Sandbox   │
│  创建   │     │  Service     │     │  Provider   │
└─────────┘     └──────────────┘     └─────────────┘
     │                                      │
     │              ┌───────────────┐      │
     └─────────────▶│  Provisioner  │──────┘
                    │  Service     │
                    └───────────────┘
```

**沙箱提供者**:
- **Daytona**: Daytona.io 云端沙箱
- **JustAVPS**: JustAVPS VPS 沙箱
- **Local Docker**: 本地 Docker 容器

**生命周期**:
1. **Provisioning**: 创建沙箱实例
2. **Active**: 沙箱运行中
3. **Stopped**: 用户停止沙箱
4. **Archived**: 归档/删除沙箱

---

## 7. 讲费系统

### 7.1 订阅模式

**订阅类型**:
- **Free**: 免费层
- **Pro**: 专业版
- **Enterprise**: 企业版

**定价**:
- 月付/年付选项
- 按用量计费(积分制)

### 7.2 积分系统

```
┌────────────────────────────────────────────────────────┐
│                  Credit System                        │
├────────────────────────────────────────────────────────┤
│                                                    │
│   ┌──────────────────┐   ┌──────────────────┐       │
│   │  credit_accounts │   │  credit_ledger   │       │
│   └──────────────────┘   └──────────────────┘       │
│                                                    │
│   balance             │   id, amount, type           │
│   lifetime_granted   │   balance_after            │
│   lifetime_purchased │   created_at              │
│   lifetime_used       │                          │
│                                                    │
└────────────────────────────────────────────────────────┘
```

**积分来源**:
- 订阅赠送(定期)
- 购买(一次性)
- 试用赠送
- 推荐奖励

**积分消耗**:
- AI 模型调用
- 文件处理
- API 请求

### 7.3 支付集成

**支付提供商**: Stripe
**功能**:
- 订阅管理
- 一次性支付
- 自动充值
- 发票生成

---

## 8. 鲁棒性与可观测性

### 8.1 日志系统

**日志级别**: ERROR, WARN, INFO, DEBUG
**日志输出**: stdout (Docker 捕获)
**结构化日志**: JSON 格式，包含:
- timestamp
- level
- message
- context (userId, accountId, sandboxId)

### 8.2 错误追踪

**工具**: Sentry
**捕获内容**:
- 未捕获异常
- 性能问题
- 用户反馈

### 8.3 匇标监控

**关键指标**:
- 请求量/响应时间
- AI 模型使用量
- 积分消耗
- 沙箱健康状态
- WebSocket 连接数

---

## 9. 安全设计

### 9.1 认证机制

**用户认证**: Supabase Auth (JWT)
**API 认证**: API Key (sandbox-scoped)
**OAuth**: 自定义 OAuth2 服务器

### 9.2 权限控制

**账户级别**:
- Owner: 账户所有者
- Admin: 账户管理员
- Member: 普通成员

**平台级别**:
- user: 普通用户
- admin: 平台管理员
- super_admin: 超级管理员

### 9.3 数据隔离

**隔离策略**:
- 账户级别隔离 (accountId)
- 沙箱级别隔离 (sandboxId)
- API Key 级别隔离 (sandbox-scoped)

---

## 10. 性能优化

### 10.1 娡型路由优化

**策略**:
- 根据任务类型选择合适模型
- 支持多模型提供商
- 模型价格/性能权衡

### 10.2 缓存策略

**缓存层**:
- 数据库查询缓存
- API 响应缓存
- 模型配置缓存

### 10.3 并发处理

**并发机制**:
- WebSocket 连接池
- 数据库连接池
- Agent 并发执行

---

## 11. 开发与部署

### 11.1 开发工作流

```bash
# 本地开发
pnpm dev              # 启动前端 + API
pnpm dev:core         # 启动沙箱运行时
pnpm dev:mobile       # 启动移动端

# 构建
pnpm build            # 构建所有包

# 测试
pnpm test             # 运行测试
```

### 11.2 鸃署架构

**部署方式**:
- **Cloud**: Aether Cloud (aether.com)
- **Self-hosted**: Docker Compose
- **VPS**: JustAVPS 镜像

**CI/CD**: GitHub Actions
**监控**: Sentry + 自定义仪表板

---

## 附录

### A. 环境变量

**必需变量**:
```env
SUPABASE_URL=           # Supabase 项目 URL
SUPABASE_ANON_KEY=      # Supabase 匿名密钥
SUPABASE_SERVICE_KEY=   # Supabase 服务密钥
STRIPE_SECRET_KEY=      # Stripe API 密钥
DATABASE_URL=          # PostgreSQL 连接字符串
```

### B. 端口映射

**服务端口**:
- 3000: Web Frontend
- 8008: API Gateway
- 14000-14008: Sandbox Runtime

### C. 匁令空间

| 匽令 | 用途 |
|------|------|
| `aether start` | 启动所有服务 |
| `aether stop` | 停止所有服务 |
| `aether logs` | 查看日志 |
| `aether status` | 查看状态 |
| `aether update` | 更新系统 |

---

## 12. 技术债务与改进建议

### 12.1 已知技术债务

| 领域 | 描述 | 优先级 | 备注 |
|------|------|--------|------|
| 数据库 | Legacy schema 迁移 | 中 | 部分 tables 仍在 `public` schema |
| API | 代码重复 | 中 | 某些路由逻辑重复，需要重构 |
| 前端 | 组件耦合 | 低 | 部分组件依赖过重，建议拆分 |
| Agent | 内存检索效率 | 中 | 长期记忆检索需要优化索引 |
| 部署 | 镜像体积过大 | 低 | 可以优化 Docker layer |

### 12.2 改进建议
#### 12.2.1 短期 (1-2 周)
1. 数据库 Schema 统一 - 将所有表迁移到 `aether` schema
2. API 错误处理标准化 - 统一错误响应格式
3. 前端组件解耦 - 提取可复用的共享组件

#### 12.2.2 中期 (1-2 月)
1. Agent 内存优化 - 实现向量检索提升长期记忆效率
2. API 缓存层 - 添加 Redis 缓存层
3. 监控仪表板完善 - 添加更详细的性能指标

#### 12.2.3 长期 (3-6 月)
1. 微服务拆分 - 考虑将部分服务独立部署
2. 多区域部署 - 支持多云/多区域部署
3. Agent 插件系统 - 开放插件 API

---

## 13. 关键代码示例

### 13.1 API 认证中间件

```typescript
// apps/api/src/middleware/auth.ts
export const supabaseAuth = async (c, next) => {
  const authHeader = c.req.header('authorization')
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  
  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  
  if (error || !user) {
    return c.json({ error: 'Invalid token' }, 401)
  }
  
  c.set('userId', user.id)
  c.set('accountId', user.user_metadata?.account_id)
  
  await next()
}
```

### 13.2 Agent 路由选择逻辑

```typescript
// apps/api/src/router/index.ts
const PROVIDER_CONFIGS = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5'],
    defaultModel: 'claude-sonnet-4-6'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    models: ['gpt-4.1', 'gpt-4o', 'o3-mini'],
    defaultModel: 'gpt-4.1'
  }
  // ... other providers
}

export function selectProvider(modelId: string) {
  // Auto-select based on model prefix
  if (modelId.startsWith('claude')) return 'anthropic'
  if (modelId.startsWith('gpt')) return 'openai'
  // Default fallback
  return 'anthropic'
}
```

### 13.3 沙箱状态管理

```typescript
// packages/db/src/schema/aether.ts
export const sandboxStatusEnum = pgEnum('sandbox_status', [
  'provisioning',  // 正在创建
  'active',         // 运行中
  'stopped',        // 已停止
  'archived',       // 已归档
  'pooled',         // 资源池中
  'error'           // 错误状态
])

// State transitions:
// provisioning → active (创建成功)
// active → stopped (用户停止)
// stopped → archived (归档)
// pooled → active (从池中取出复用)
// any → error (发生错误)
```

---

**文档版本**: 1.0
**最后更新**: 2026-04-08
