# Aether UI 复用与 A2UI 集成分析

**日期**: 2026-04-13
**状态**: 研究完成
**主题**: LiteLLM UI / Aether UI 复用可能性 + Google A2UI 引入评估

---

## 1. 当前 Aether (Aether) UI 现状

### 技术栈
- **框架**: Next.js 15.5 + React + TypeScript
- **UI 库**: shadcn/ui (89 个组件) + Radix UI + Tailwind CSS
- **状态管理**: Zustand stores + React Query
- **实时通信**: Supabase Realtime + SSE
- **代码规模**: 100+ TSX 组件, 45 个组件目录

### 功能模块
| 模块 | 路径 | 功能 |
|------|------|------|
| Session Chat | `components/session/` (26 files) | AI 对话核心，5470行主文件 |
| Session Layout | `components/session/session-layout.tsx` | 左右分栏 (Chat + AetherComputer) |
| Tool Renderers | `components/session/tool-renderers.tsx` | Agent 工具调用可视化 |
| PTY Terminal | `components/session/pty-terminal*.tsx` | 内嵌终端 |
| Model Selector | `components/session/model-selector.tsx` | 模型/Provider 选择器 |
| Sidebar | `components/sidebar/` (10 files) | 导航、线程列表 |
| Billing | `components/billing/` | 信用额度、订阅、自动充值 |
| Onboarding | `components/onboarding/` | 新用户引导向导 |
| Channels | `components/channels/` | Slack/Telegram 集成 |
| File Renderers | `components/file-renderers/` (10 types) | SQL/CSV/Video/Image/XLSX/DOCX 等 |
| Deployments | `components/deployments/` | 部署管理 |
| Admin | `components/admin/` | 管理后台 |

### Dashboard 路由 (30 个页面)
`admin/`, `browser/`, `channels/`, `commands/`, `configuration/`, `connectors/`, `dashboard/`, `deployments/`, `desktop/`, `files/`, `marketplace/`, `memory/`, `projects/`, `scheduled-tasks/`, `service-manager/`, `services/`, `sessions/`, `settings/`, `skills/`, `terminal/`, `tools/`, `tunnel/`, `workspace/`

---

## 2. LiteLLM UI 复用分析

### LiteLLM Dashboard 概况
- **位置**: `BerriAI/litellm/ui/litellm-dashboard/`
- **技术栈**: Next.js 16 + React 18 + Tailwind CSS + Tremor Charts + Ant Design
- **规模**: 完整的 admin dashboard，有 `app/`, `components/`, `hooks/`, `contexts/` 等目录

### 可复用的组件/功能
| 功能 | 复用价值 | 复用方式 |
|------|----------|----------|
| **Model 管理页面** | ⭐⭐⭐⭐⭐ | 直接复用：模型列表、添加/编辑模型、Model Fallback 配置 |
| **API Key 管理** | ⭐⭐⭐⭐⭐ | 直接复用：虚拟 Key CRUD、Key 权限、预算设置 |
| **Usage/Spending Dashboard** | ⭐⭐⭐⭐⭐ | 直接复用：消耗图表、费用追踪、按 Key/Model 统计 |
| **Provider 配置** | ⭐⭐⭐⭐ | 参考复用：Azure/AWS/GCP/Bedrock 配置表单 |
| **Team 管理** | ⭐⭐⭐ | 参考复用：团队成员、权限、配额（Aether 已有自己的 auth） |
| **Audit Logs** | ⭐⭐⭐ | 直接复用：API 调用日志、错误追踪 |
| **Rate Limit 配置** | ⭐⭐⭐ | 参考复用：TPM/RPM 限制 UI |

### 复用策略
**推荐方式**: 将 LiteLLM Dashboard 作为 Aether 的一个子路由 `/admin/llm` 嵌入

```
apps/web/src/app/(dashboard)/admin/llm/
├── page.tsx                    # LLM 管理首页 (embed LiteLLM dashboard)
├── models/page.tsx             # 模型管理
├── keys/page.tsx               # API Key 管理
├── usage/page.tsx              # 用量统计
└── settings/page.tsx           # Provider 配置
```

**具体操作**:
1. 将 LiteLLM Dashboard 的核心组件抽取为 `packages/litellm-ui/`
2. 适配 Aether 的认证体系（替换 LiteLLM 自己的 JWT auth）
3. 适配 Aether 的主题系统（shadcn/ui 主题 → Ant Design 组件）
4. 共享 API client（通过 Aether API 代理到 LiteLLM Proxy）

### 复用障碍
- **UI 框架不同**: LiteLLM 用 Ant Design + Tremor，Aether 用 shadcn/ui → 需要 theme bridge
- **认证不同**: LiteLLM 有自己的 JWT，Aether 用 Supabase Auth → 需要 SSO/proxy
- **数据获取不同**: LiteLLM 直连 Proxy API，Aether 需要经过自己的 API 层

---

## 3. Aether (Aether 上游) UI 复用分析

### 复用现状
Aether **本身就是 Aether/Aether 的 fork**，所以 Aether UI 就是当前 UI。关键问题是：**上游 UI 改造 vs Aether 定制化的冲突管理**。

### 上游可复用的 UI 新特性
根据上游 DeepWiki 文档，Aether 持续在更新：
- **AgentDrawer**: 模型选择器、Provider 切换
- **AetherComputer**: 侧面板 (side panel)，展示 Agent 工具执行
- **ToolViewRegistry**: 工具可视化的注册表模式 → **这个模式对垂直定制非常有价值**
- **双列布局**: Chat + Side Panel 的 ResizablePanelGroup

### 定制化 UI 的最佳实践（与上游兼容）
```
packages/
├── theme/           # 已有：品牌主题
├── vertical/
│   ├── finance/
│   │   └── ui/      # 金融行业专属 UI 组件
│   ├── healthcare/
│   │   └── ui/      # 医疗行业专属 UI 组件
│   └── retail/
│       └── ui/      # 零售行业专属 UI 组件
└── shared/          # 已有：共享组件
```

**关键原则**:
1. 不修改 `apps/web/src/components/` 下的上游组件
2. 通过 `packages/vertical/*/ui/` 添加行业专属组件
3. 用 Menu Registry + Feature Flag 控制组件加载
4. 上游更新时只 merge `apps/web/` 的变更

---

## 4. Google A2UI 引入分析

### A2UI 是什么
Google A2UI (Agent-to-User Interface) 是一个 **开放协议** (Apache 2.0)，定义 AI Agent 如何生成结构化、交互式 UI。核心思想：

> **Agent 发出声明式 JSON → Client 用原生组件渲染 → 安全如数据，表达力如代码**

### A2UI 核心架构
```
Agent (LLM) → A2UI JSON Messages → Transport (A2A/AG-UI/WebSocket)
                                              ↓
                                         Client Renderer
                                              ↓
                                    Native UI Components
                                   (React/Flutter/Web)
```

### 协议特点
| 特性 | 说明 |
|------|------|
| **声明式** | JSON 描述 UI 意图，不执行代码 |
| **流式** | JSONL 逐行流式渲染 |
| **可扩展** | Catalog 系统定义可用组件集 |
| **LLM 友好** | 结构简单，LLM 可直接生成 |
| **Transport 无关** | 可走 A2A、AG-UI、MCP、WebSocket、REST |

### 消息类型
| 类型 | 用途 |
|------|------|
| `surfaceUpdate` | 添加/更新 UI 组件到 Surface |
| `updateData` | 更新已有组件的数据 |
| `deleteSurface` | 删除 Surface |
| `userAction` | 用户交互事件 |

### 标准组件 (Basic Catalog)
Text, Card, Button, TextField, Image, Table, Form, List, Chart 等

---

## 5. A2UI 对 Aether 的核心价值

### 5.1 解决"Chat Wall"问题
当前 Aether 的 Session Chat 是纯文本 + 工具卡片模式。A2UI 让 Agent 能生成：
- **数据表格**: 金融行业的交易明细、持仓报表
- **表单**: 医疗行业的病历录入、审批流程
- **图表**: 零售行业的销售趋势、库存预警
- **交互卡片**: 按钮、选择器、日期选择器

### 5.2 垂直行业 UI 定制的革命性方案
不用为每个行业写大量前端代码，而是让 **行业 Agent 自己生成 UI**：

```
金融 Agent → A2UI JSON → 渲染交易面板、风控仪表盘
医疗 Agent → A2UI JSON → 渲染病历表单、诊断卡片
零售 Agent → A2UI JSON → 渲染库存表格、促销配置器
```

**这意味着**: 垂直行业的 UI 差异主要在 **Agent Prompt + Custom Catalog**，而非大量前端代码。

### 5.3 与 Aether 现有架构的契合点

| Aether 组件 | A2UI 映射 |
|-------------|-----------|
| Session Chat | 每个 AI 回复 → 一个 Surface |
| AetherComputer (Side Panel) | 工具执行结果 → A2UI Card/Table |
| ToolViewRegistry | A2UI Custom Catalog + Renderer |
| 模型选择器 (ModelSelector) | 无关，保持现有 |
| PTY Terminal | 无关，保持现有 |

### 5.4 具体集成方案

```
apps/web/src/
├── components/
│   ├── a2ui/                      # NEW: A2UI 渲染器
│   │   ├── a2ui-renderer.tsx      # 核心 JSONL → React 组件
│   │   ├── a2ui-surface.tsx       # Surface 容器
│   │   ├── catalog/
│   │   │   ├── basic-catalog.tsx  # 标准 A2UI 组件映射
│   │   │   ├── finance-catalog.tsx  # 金融行业自定义组件
│   │   │   └── healthcare-catalog.tsx
│   │   └── hooks/
│   │       ├── use-a2ui-stream.ts  # 解析 JSONL 流
│   │       └── use-a2ui-actions.ts # 用户交互回调
│   └── session/
│       └── session-chat.tsx       # 修改: 在 message 渲染中集成 A2UI
```

### 5.5 Transport 选择

A2UI 是 transport-agnostic，推荐方案：

**首选: 直接 SSE (与现有架构最兼容)**
```
Agent → A2UI JSONL → Aether API SSE → Frontend Renderer
```
Aether 已经有 SSE 流式传输 (`useOpenCodeMessages`)，A2UI JSONL 可以直接嵌入现有 SSE stream。

**备选: A2A Protocol (长期)**
如果未来要做 Agent-to-Agent 通信，A2A 是更好的选择。但短期无需引入。

### 5.6 工作量评估

| 阶段 | 内容 | 工时 |
|------|------|------|
| Phase 1 | 基础 A2UI Renderer (Basic Catalog) | 2-3 天 |
| Phase 2 | 与 Session Chat 集成 | 1-2 天 |
| Phase 3 | 金融行业 Custom Catalog | 3-5 天 |
| Phase 4 | 医疗/零售 Custom Catalog | 各 2-3 天 |
| **总计** | | **8-14 天** |

---

## 6. 三者关系与整合建议

```
┌─────────────────────────────────────────────────┐
│                 Aether UI Layer                   │
│                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │  Aether/Aether │  │  A2UI        │  │ LiteLLM │ │
│  │  (上游 fork) │  │  Renderer    │  │ Admin   │ │
│  │             │  │              │  │ Panel   │ │
│  │ • Session   │  │ • JSONL→React│  │         │ │
│  │   Chat      │  │ • Catalog    │  │ • Model │ │
│  │ • Sidebar   │  │   System     │  │   Mgmt  │ │
│  │ • Terminal  │  │ • Per-       │  │ • Usage │ │
│  │ • ToolViews │  │   Vertical   │  │ • Keys  │ │
│  │ • Settings  │  │   Catalogs   │  │ • Logs  │ │
│  └─────────────┘  └──────────────┘  └─────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │        packages/theme/ (品牌主题层)          │ │
│  │        packages/vertical/*/ui/ (行业 UI)     │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### 三者定位总结

| 来源 | 角色 | 复用方式 |
|------|------|----------|
| **Aether/Aether** | 基础 UI 骨架 | Fork 持续同步，不修改核心组件 |
| **LiteLLM UI** | LLM 管理后台 | 抽取组件作为 `/admin/llm` 子模块 |
| **Google A2UI** | Agent 动态 UI 渲染 | 新建 Renderer 层，嵌入 Session Chat |

---

## 7. 推荐实施路线

### Phase 1: 基础 A2UI Renderer (Week 1-2)
- 实现 `a2ui-renderer.tsx` + Basic Catalog
- 在 Session Chat 中渲染 A2UI Surface
- 验证 Agent 能输出 A2UI JSONL 并正确渲染

### Phase 2: LiteLLM Admin Panel (Week 2-3)
- 从 LiteLLM Dashboard 抽取核心组件到 `packages/litellm-ui/`
- 实现 `/admin/llm` 路由
- 适配认证和主题

### Phase 3: 行业 Custom Catalog (Week 3-5)
- 金融: 交易面板、风控仪表盘
- 医疗: 病历表单、诊断卡片
- 零售: 库存表格、促销配置器

### Phase 4: 上游同步优化 (持续)
- 将 ToolViewRegistry 模式与 A2UI Catalog 对齐
- 确保上游 merge 时 A2UI 层不受影响
