# Aether 统一 UI 架构设计方案

**日期**: 2026-04-13
**状态**: Approved — 已确认
**作者**: Aether Team
**范围**: UI 层整体重构 — 摆脱上游 UI 约束，统一技术栈，引入 A2UI，复写 LiteLLM 管理界面
**评审记录**: 2026-04-13 评审通过，5 项修改意见已整合

---

## 0. 核心决策

| 决策 | 结论 |
|------|------|
| 与上游 UI 保持一致？ | **否** — UI 完全自主，不走上游 sync |
| LiteLLM UI 复用方式？ | **重写** — 用 Aether 的 shadcn/ui + TanStack 堆栈重写，不嵌入 LiteLLM Dashboard |
| 架构目标 | **统一技术栈、消除重复依赖、分层清晰、A2UI 原生支持** |
| packages/ui 包结构 | **单包 + subpath exports** — 逻辑隔离，tree-shakeable |
| 3D/图形库 | **审计后决定** — 先确认 core/ 和 apps/api/ 依赖，再删除 |
| SDK 层级 | **client/server 分层** — SDK 不混合 React 和 Node 依赖 |
| 实施顺序 | **Finance UI 提前** — 与 SaaS 实施主线对齐 |

### 评审修改记录 (2026-04-13)

1. **单包策略确认**: packages/ui 维持单包，但通过 subpath exports 做逻辑隔离。规则：子模块间不能直接 import 内部实现，只能通过 public API。
2. **3D/图形库暂缓删除**: 需先审计 core/ 和 apps/api/ 中图形库的实际使用情况，确认安全后再删除 Konva/OGL。
3. **SDK 拆分 client/server**: `@acme/sdk` 拆为 client（React hooks + React Query）和 server（Supabase admin + API helpers）两层，避免 React 污染 Node 环境。
4. **Phase 顺序调整**: Finance UI 组件从 Phase 5 提前到 Phase 3，与后端 Finance API 同步推进。
5. **A2UI Catalog 版本策略**: 暂不处理，后续 A2UI 协议升级时再补充。

---

## 1. 现状诊断：问题清单

### 1.1 依赖爆炸

当前 `apps/web/package.json` 有 **233 个 dependencies**，其中大量重叠：

| 领域 | 重复系统 | 具体包 |
|------|----------|--------|
| Grid/Table | 3 套 | ag-grid, Syncfusion ej2-grids, TanStack Table |
| PDF | 4 套 | react-pdf, pdfjs-dist, @react-pdf/renderer, html2pdf.js |
| Spreadsheet | 3 套 | xlsx, exceljs, Syncfusion Spreadsheet |
| Charts | 3 套 | chart.js, recharts, mermaid |
| 3D/Graphics | 4 套 | Three.js, React-Three-Fiber, Konva, OGL |
| Rich Text | 2 套 | react-markdown, marked |
| Editor | 2 套 | TipTap (43 extensions), CodeMirror |
| Animation | 3 套 | framer-motion, motion, gsap |
| State | 2 套 | zustand, yjs |

### 1.2 组件目录混乱

```
apps/web/src/
├── components/          # 45 个子目录，402 个 TSX 文件
├── hooks/               # 37 个子目录，涵盖所有业务
├── stores/              # 31 个 store 文件
├── lib/                 # 100+ 工具文件，杂乱
├── features/            # 只有 files/ 和 skills/（半成品）
├── app/                 # 30 个 dashboard 路由
└── ui/                  # 只有 1 个文件
```

问题：
- `components/` 同时包含 UI 原子组件、业务组件、页面组件
- `hooks/` 按业务分目录但粒度不统一
- `lib/` 成了垃圾桶
- `features/` 只有两个目录，说明功能模块化尝试没完成

### 1.3 上游耦合点

以下文件与 Aether/Aether 上游强绑定：
- 品牌相关：`acme-logo.tsx`, `acme-loader.tsx`, `acme-enterprise-modal.tsx`
- 命名约定：stores 里的 `acme-computer-store.ts`，lib 里的 `acme-*`
- 路由结构：instance-scoped 路由 (`/p/[port]/`)，上游特有设计
- 认证流程：middleware.ts 里的 Aether 特定 cookie 和路由

---

## 2. 统一架构设计

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/web (Next.js)                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  /chat   │  │  /admin  │  │ /{vertical}│  │  /public     │  │
│  │  Agent   │  │  LLM管理  │  │ 行业路由   │  │  落地页/文档  │  │
│  │  对话    │  │  平台管理  │  │ 金融/医疗  │  │  认证/帮助   │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    packages/ui (统一组件库)                  │ │
│  │                                                              │ │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌───────────────┐  │ │
│  │  │ primitives│ │  a2ui    │ │  admin   │ │   vertical    │  │ │
│  │  │  基础组件 │ │ renderer │ │  管理组件 │ │   行业组件    │  │ │
│  │  │  (shadcn)│ │ 渲染器   │ │  LLM等   │ │ 金融/医疗/零售│  │ │
│  │  └─────────┘ └──────────┘ └─────────┘ └───────────────┘  │ │
│  │                                                              │ │
│  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │  chat   │ │  editor  │ │ data-viz │ │  media       │  │ │
│  │  │  对话   │ │  编辑器  │ │  可视化  │ │  媒体渲染    │  │ │
│  │  └─────────┘ └──────────┘ └──────────┘ └──────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    packages/sdk (统一 SDK)                    │ │
│  │  auth/  api-client/  llm/  realtime/  storage/  a2ui/      │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 模块隔离规则

packages/ui 虽是单包，但子模块之间有严格的依赖边界：

1. **子模块不能直接 import 另一个子模块的内部实现**，只能通过 public API（exports.ts）
2. **primitives 是唯一可被所有子模块依赖的层** — 其他子模块互相独立
3. **vertical/ 子模块只依赖 primitives + a2ui** — 不依赖 admin/chat/editor
4. **依赖方向**: `primitives ← chat, a2ui, admin, vertical, editor, data-viz, media, layout`

### 2.3 packages 层重新设计

```
packages/
├── ui/                         # 统一组件库 (NEW — 核心)
│   ├── package.json
│   ├── src/
│   │   ├── primitives/         # 基础 UI 原子组件 (shadcn/ui 精简版)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx       # 统一为 TanStack Table
│   │   │   ├── chart.tsx       # 统一为 Recharts
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   └── ... (约 30 个核心组件)
│   │   │
│   │   ├── chat/               # Agent 对话组件
│   │   │   ├── chat-container.tsx
│   │   │   ├── message-list.tsx
│   │   │   ├── message-bubble.tsx
│   │   │   ├── chat-input.tsx
│   │   │   ├── tool-renderer.tsx
│   │   │   ├── pty-terminal.tsx
│   │   │   └── model-selector.tsx
│   │   │
│   │   ├── a2ui/               # A2UI 渲染引擎
│   │   │   ├── renderer.tsx
│   │   │   ├── surface.tsx
│   │   │   ├── catalog/
│   │   │   │   ├── basic.tsx       # 标准 Catalog (Text/Card/Table/Form)
│   │   │   │   ├── finance.tsx     # 金融行业
│   │   │   │   ├── healthcare.tsx  # 医疗行业
│   │   │   │   └── retail.tsx      # 零售行业
│   │   │   ├── hooks/
│   │   │   │   ├── use-a2ui-stream.ts
│   │   │   │   └── use-a2ui-actions.ts
│   │   │   └── types.ts
│   │   │
│   │   ├── admin/              # 管理后台组件 (重写 LiteLLM 功能)
│   │   │   ├── llm/
│   │   │   │   ├── model-list.tsx
│   │   │   │   ├── model-form.tsx
│   │   │   │   ├── key-manager.tsx
│   │   │   │   ├── usage-dashboard.tsx
│   │   │   │   ├── provider-config.tsx
│   │   │   │   └── audit-logs.tsx
│   │   │   ├── platform/
│   │   │   │   ├── user-table.tsx
│   │   │   │   ├── tenant-config.tsx
│   │   │   │   └── feature-flags.tsx
│   │   │   └── billing/
│   │   │       ├── credit-dashboard.tsx
│   │   │       └── subscription-manager.tsx
│   │   │
│   │   ├── vertical/           # 行业组件 (从 vertical packages 加载)
│   │   │   ├── finance/
│   │   │   │   ├── transaction-panel.tsx
│   │   │   │   ├── risk-dashboard.tsx
│   │   │   │   └── invoice-builder.tsx
│   │   │   ├── healthcare/
│   │   │   │   ├── patient-form.tsx
│   │   │   │   ├── diagnosis-card.tsx
│   │   │   │   └── prescription-editor.tsx
│   │   │   └── retail/
│   │   │       ├── inventory-table.tsx
│   │   │       ├── promotion-builder.tsx
│   │   │       └── sales-dashboard.tsx
│   │   │
│   │   ├── editor/             # 统一编辑器
│   │   │   ├── rich-text.tsx       # TipTap 精简版
│   │   │   ├── code-editor.tsx     # CodeMirror
│   │   │   ├── markdown-editor.tsx
│   │   │   └── spreadsheet.tsx     # 统一为 xlsx + 自定义
│   │   │
│   │   ├── data-viz/           # 统一可视化
│   │   │   ├── line-chart.tsx      # Recharts
│   │   │   ├── bar-chart.tsx
│   │   │   ├── pie-chart.tsx
│   │   │   ├── data-table.tsx      # TanStack Table
│   │   │   └── mermaid-diagram.tsx # Mermaid (仅 diagram)
│   │   │
│   │   ├── media/              # 统一媒体渲染
│   │   │   ├── pdf-viewer.tsx      # pdfjs-dist (唯一)
│   │   │   ├── image-preview.tsx
│   │   │   ├── video-player.tsx
│   │   │   ├── file-icon.tsx
│   │   │   └── file-renderer.tsx   # 统一分发
│   │   │
│   │   └── layout/             # 布局组件
│   │       ├── app-shell.tsx
│   │       ├── sidebar.tsx
│   │       ├── tab-bar.tsx
│   │       ├── resizable-panel.tsx
│   │       └── command-palette.tsx
│   │
│   └── exports.ts              # 统一导出
│
├── sdk/                        # 统一 SDK (NEW)
│   ├── package.json
│   ├── src/
│   │   ├── client/             # 前端专用（依赖 React）
│   │   │   ├── hooks/          # React Query hooks
│   │   │   └── providers/     # React Context providers
│   │   ├── server/             # 后端专用（纯 Node，无 React）
│   │   │   ├── supabase-admin.ts
│   │   │   └── api-helpers.ts
│   │   ├── auth/               # 共享 Auth 类型 + 逻辑
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   └── middleware.ts
│   │   ├── api/                # API Client（纯逻辑，无 React）
│   │   │   ├── client.ts
│   │   │   ├── llm.ts         # LiteLLM Proxy API
│   │   │   ├── billing.ts
│   │   │   └── platform.ts
│   │   ├── realtime/           # SSE + Supabase Realtime
│   │   │   ├── event-stream.ts
│   │   │   └── subscriptions.ts
│   │   ├── llm/                # LLM 交互
│   │   │   ├── models.ts
│   │   │   ├── providers.ts
│   │   │   └── keys.ts
│   │   ├── a2ui/               # A2UI Protocol
│   │   │   ├── parser.ts       # JSONL parser
│   │   │   ├── validator.ts    # Schema validation
│   │   │   ├── catalog.ts      # Catalog manager
│   │   │   └── types.ts        # Protocol types
│   │   └── index.ts
│   └── tsconfig.json
│
├── theme/                      # 品牌主题 (保留，扩展)
│   ├── src/
│   │   ├── colors.ts           # 品牌色
│   │   ├── typography.ts       # 字体
│   │   ├── spacing.ts          # 间距
│   │   ├── motion.ts           # 动效 (统一为 framer-motion)
│   │   └── verticals/          # 行业主题变体
│   │       ├── finance.ts
│   │       ├── healthcare.ts
│   │       └── retail.ts
│   └── package.json
│
├── db/                         # 数据库 (保留)
├── shared/                     # 共享工具 (保留)
├── agent-tunnel/               # Agent Tunnel (保留)
│
├── finance/                    # 垂直行业 — 后端逻辑 (保留)
├── healthcare/                 # 垂直行业 — 后端逻辑 (保留)
└── retail/                     # 垂直行业 — 后端逻辑 (保留)
```

### 2.4 依赖精简方案

**原则：每个领域只保留一个系统**

| 领域 | 保留 | 删除 | 理由 |
|------|------|------|------|
| **Grid/Table** | `@tanstack/react-table` | ag-grid, Syncfusion grids | TanStack 是 headless UI，与 shadcn 完美搭配 |
| **PDF** | `pdfjs-dist` | react-pdf, @react-pdf/renderer, html2pdf.js | 最底层，完全可控 |
| **Spreadsheet** | `xlsx` + 自定义组件 | exceljs, Syncfusion Spreadsheet | xlsx 读写能力最全 |
| **Charts** | `recharts` | chart.js | Recharts 声明式 API，React 原生 |
| **3D** | 仅 landing 页保留 `three` | konva, ogl, react-konva | 非核心，按需加载 |
| **Rich Text** | `react-markdown` | marked | 更安全，rehype 插件生态好 |
| **Editor** | `@tiptap` (精简到 10 个扩展) + `codemirror` | 无 | 两个职责不同，都保留但精简 |
| **Animation** | `framer-motion` | motion (重复), gsap | framer-motion 最成熟 |
| **State** | `zustand` + `@tanstack/react-query` | yjs (除非协作编辑需要) | 够用 |

**精简后预估**: 从 **233 → ~120 个** dependencies，减少 **~48%**

### 2.5 apps/web 瘦身

重构后 `apps/web` 只保留：
- 路由定义 (`app/`)
- 页面组装逻辑
- 中间件
- 环境配置

```typescript
// apps/web/src/app/(dashboard)/admin/llm/page.tsx — 示例
import { ModelList } from '@acme/ui/admin';
import { createLLMApi } from '@acme/sdk';

export default function LLMManagementPage() {
  return <ModelList api={createLLMApi()} />;
}
```

```typescript
// apps/web/src/app/(dashboard)/chat/page.tsx — 示例
import { ChatContainer, A2UISurface } from '@acme/ui';
import { useSession } from '@acme/sdk';

export default function ChatPage() {
  const session = useSession();
  return (
    <ChatContainer session={session}>
      <A2UISurface catalog="finance" />
    </ChatContainer>
  );
}
```

### 2.6 A2UI 集成架构

```
┌─────────────┐     JSONL/SSE      ┌──────────────────┐
│  Agent      │ ──────────────────→ │  A2UI Renderer   │
│  (OpenCode) │                     │  (packages/ui)   │
│             │ ←────────────────── │                  │
│             │     userAction      │  Catalog System  │
└─────────────┘                     │  ┌─────────────┐ │
                                    │  │ basic       │ │
                                    │  │ finance     │ │
                                    │  │ healthcare  │ │
                                    │  │ retail      │ │
                                    │  └─────────────┘ │
                                    └──────────────────┘
```

**关键设计**:
1. `packages/sdk/src/a2ui/` — JSONL 解析、Schema 校验、Catalog 管理
2. `packages/ui/src/a2ui/` — React 渲染器，Catalog → shadcn/ui 组件映射
3. 每个 Catalog 是一个 `Map<string, React.ComponentType>` — 将 A2UI 类型名映射到实际组件
4. 行业 Catalog 扩展 Basic Catalog — 添加行业特有组件

---

## 3. 与上游关系的新定义

### 3.1 不再同步 UI

| 层 | 上游同步？ | 说明 |
|----|-----------|------|
| `apps/api/` | ✅ 同步 | 后端逻辑保持同步 |
| `core/` | ✅ 同步 | Agent 运行时保持同步 |
| `packages/db/` | ✅ 同步 | 数据库 schema 同步 |
| `apps/web/` | ❌ 不同步 | **完全自主** |
| `packages/ui/` | ❌ 新建 | **自有组件库** |
| `packages/sdk/` | ❌ 新建 | **自有 SDK** |

### 3.2 上游更新策略

```
git fetch upstream main
git merge upstream main --no-commit

# 冲突解决策略：
# - apps/api/ → 保留上游变更
# - core/ → 保留上游变更
# - packages/db/ → 保留上游变更
# - apps/web/ → 保留我们的版本，手动 cherry-pick 有价值的后端 API 变更
# - packages/ui, packages/sdk → 不存在冲突（上游没有这些）
```

---

## 4. LiteLLM 管理界面重写方案

### 4.1 功能清单

从 LiteLLM Dashboard 提取需要的管理功能：

| 页面 | 功能 | 对应 LiteLLM API |
|------|------|-----------------|
| 模型列表 | 查看/添加/编辑/删除模型 | GET/POST/PUT/DELETE /model/ |
| 模型分组 | 模型别名、fallback 链 | GET/POST /model/group/ |
| API Key 管理 | 虚拟 Key CRUD、预算、限速 | GET/POST/DELETE /key/ |
| 用量仪表盘 | 按 Key/Model/Team 统计 | GET /global/spend/keys, /spend/models |
| Provider 管理 | OpenAI/Anthropic/Azure 等配置 | 环境变量 + /health |
| 审计日志 | 请求日志、错误追踪 | GET /request/success, /request/failure |
| 团队管理 | 成员、权限 | GET/POST /team/ |

### 4.2 技术实现

全部用 Aether 的统一堆栈重写：
- **UI**: shadcn/ui 组件 + TanStack Table + Recharts
- **数据**: `@tanstack/react-query` + `@acme/sdk` 的 LLM 模块
- **路由**: `/admin/llm/*`

不需要 Ant Design、Tremor 等额外 UI 库。

---

## 5. 实施计划

### Phase 0: 准备 (Week 1)
- [x] 创建 `packages/ui/` 和 `packages/sdk/` 骨架
- [x] 配置 workspace 依赖
- [ ] 建立 3D/图形库依赖审计（core/ + apps/api/ 中使用情况）
- [ ] 建立组件迁移 checklist

### Phase 1: SDK 层 (Week 1-2)
- [ ] `packages/sdk/src/auth/` — 从 `apps/web/src/lib/supabase/` 迁移
- [ ] `packages/sdk/src/api/` — 从 `apps/web/src/lib/api-client.ts` 迁移
- [ ] `packages/sdk/src/realtime/` — SSE 流解析
- [ ] `packages/sdk/src/a2ui/` — A2UI 协议层 (parser, validator, types)
- [ ] `packages/sdk/src/llm/` — LiteLLM Proxy API 封装
- [ ] SDK 拆分 client/server — exports 映射 + React 依赖隔离

### Phase 2: Primitives + Layout (Week 2-3)
- [ ] `packages/ui/src/primitives/` — 精选 30 个核心 shadcn/ui 组件（已有 17 个）
- [ ] `packages/ui/src/layout/` — AppShell, Sidebar, TabBar
- [ ] 删除审计确认安全的重复依赖 (ag-grid, Syncfusion, chart.js, gsap, motion, marked)

### Phase 3: Chat + Finance UI (Week 3-4) ← 调整：Finance 提前
- [ ] `packages/ui/src/chat/` — Session Chat 组件迁移
- [ ] `packages/ui/src/a2ui/` — A2UI Renderer + Basic Catalog
- [ ] 在 Chat 组件中集成 A2UI Surface
- [ ] `packages/ui/src/vertical/finance/` — 金融组件 + A2UI Finance Catalog（提前）
- [ ] 与后端 Finance API 联调

### Phase 4: Admin 重写 (Week 4-5)
- [ ] `packages/ui/src/admin/llm/` — LiteLLM 管理界面重写
- [ ] `packages/ui/src/admin/platform/` — 租户/用户管理
- [ ] `packages/ui/src/admin/billing/` — 计费管理

### Phase 5: 其余行业组件 (Week 5-6)
- [ ] `packages/ui/src/vertical/healthcare/` — 医疗组件 + A2UI Healthcare Catalog
- [ ] `packages/ui/src/vertical/retail/` — 零售组件 + A2UI Retail Catalog

### Phase 6: apps/web 瘦身 (Week 6-7)
- [ ] 清理 `apps/web/src/components/` — 大部分迁移到 packages/ui
- [ ] 清理 `apps/web/src/hooks/` — 业务逻辑迁移到 packages/sdk
- [ ] 清理 `apps/web/src/stores/` — 保留纯 UI 状态，业务状态迁移到 sdk
- [ ] 清理 `apps/web/src/lib/` — 工具函数迁移到 packages/shared 或 packages/sdk
- [ ] 精简 `apps/web/package.json` — 从 233 → ~120 dependencies

### Phase 7: 上游同步改造 (Week 7-8)
- [ ] 更新 `FORK_MAINTENANCE.md` — 明确 UI 不再同步
- [ ] 配置 `.gitattributes` — 减少 UI 文件的 merge 冲突
- [ ] 测试上游 merge — 确保只影响 api/core/db

---

## 6. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 迁移期间功能回归 | 高 | 每个Phase都有E2E测试验证，Phase间可并行运行新旧代码 |
| 上游大改 API 接口 | 中 | SDK 层抽象隔离，只需改 sdk/api/ 适配层 |
| A2UI 协议不稳定 (v0.8 stable, v0.9 draft) | 低 | 仅依赖 v0.8 stable spec，v0.9 向后兼容 |
| 精简依赖导致某些功能缺失 | 中 | Phase 6 逐个验证，保留必要的包 |
| 垂直行业组件需求不明确 | 中 | 先做 A2UI 动态生成，减少硬编码组件 |

---

## 7. 成功指标

| 指标 | 当前 | 目标 |
|------|------|------|
| dependencies 数量 | 233 | ~120 |
| 组件库位置 | 散落在 apps/web | 统一在 packages/ui |
| 重复 UI 系统 | 9 个领域有重复 | 每个领域 1 个 |
| LiteLLM 管理 | 无 | 完整重写，集成到 /admin/llm |
| A2UI 支持 | 无 | 完整 Renderer + 4 个 Catalog |
| 上游 UI 同步成本 | 高 (30+ 页面) | 零 (不同步 UI) |
| 新增行业 UI 开发周期 | 数周 (写前端代码) | 数天 (A2UI Catalog + Prompt) |
