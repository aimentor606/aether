# Agent 能力增强分析与路线图

> 日期：2026-04-11
> 状态：分析完成，待实施
> 范围：`core/aether-master/opencode/` — OpenCode 插件 + Agent 定义

---

## 1. 现状：Aether Agent 系统架构

### 1.1 整体架构

```
aether-system.ts（单插件入口）
  ├── 加载子模块（load() 包装，单个失败不影响全局）
  │   ├── projects.ts      → 项目管理（6 工具）
  │   ├── tasks.ts         → 任务管理（5 工具）
  │   ├── agent.ts         → Agent 生命周期（4 工具）
  │   ├── sessions.ts      → 会话管理（5 工具）
  │   ├── connectors.ts    → 连接器管理（4 工具）
  │   ├── pty-tools.ts     → PTY 终端（5 工具）
  │   ├── worktree/        → Git Worktree（2 工具）
  │   ├── autowork/        → 自主循环（DONE/VERIFIED 协议）
  │   ├── triggers.ts      → Cron/Webhook 触发器
  │   ├── auth.ts          → Anthropic 认证集成
  │   ├── btw.ts           → /btw 快捷问答
  │   └── todo-enforcer/   → Todo 强制执行（当前禁用）
  ├── 注册 Hooks
  │   ├── tool.execute.before          → 项目门控
  │   ├── chat.messages.transform      → 项目状态注入
  │   ├── chat.system.transform        → Agent 使命 prompt 注入
  │   ├── command.execute.before       → /btw 拦截
  │   ├── event                        → Agent 异步完成通知
  │   └── session.compacting           → 压缩时注入活跃任务
  └── 导出 37 个工具
```

### 1.2 Agent 定义

| Agent | 文件 | 角色 | 模式 |
|---|---|---|---|
| **aether** | `agents/aether.md` | 主 agent（740 行系统 prompt） | primary — 直接工作 + 编排 worker |
| **worker** | `agents/worker.md` | 自主子 agent（149 行） | all — 全工具，无编排权限 |

**Aether Agent 工作模式（4 级）：**
- Level 1: 独自完成（大多数请求）
- Level 2: 独自 + 1 个 Worker（隔离子任务）
- Level 3: 协调团队（多 Worker 并行）
- Level 4: `/autowork` 全编排模式（纯协调者）

### 1.3 工具清单（37 个）

| 分类 | 工具 | 来源文件 |
|---|---|---|
| **项目** | project_create, project_list, project_get, project_update, project_delete, project_select | projects.ts |
| **任务** | task_create, task_list, task_update, task_done, task_delete | tasks.ts |
| **Agent** | agent_spawn, agent_message, agent_stop, agent_status | agent.ts |
| **会话** | session_list, session_get, session_search, session_lineage, session_stats | sessions.ts |
| **连接器** | connector_list, connector_get, connector_setup, connector_remove | connectors.ts |
| **PTY** | pty_spawn, pty_write, pty_read, pty_list, pty_kill | pty/opencode-pty/ |
| **Worktree** | worktree_create, worktree_delete | worktree/worktree.ts |
| **触发器** | triggers, agent_triggers, cron_triggers, event_triggers, sync_* | triggers.ts |
| **其他** | instance_dispose | aether-system.ts |

### 1.4 领域 Skills（40+）

| 分类 | Skills |
|---|---|
| **交互** | agent-browser, agent-tunnel, computer-use, connectors |
| **文档** | pdf, docx, xlsx, presentations, pptx, media, remotion, elevenlabs, logo-creator, document-review, design-foundations, theme-factory |
| **研究** | deep-research, research-assistant, research-report, openalex-paper-search, paper-creator, hyper-fast-youtube-transcript, exploration, statistical-analysis, visualization, validation |
| **工程** | fastapi-sdk, sql-queries, website-building, webapp, replicate, coding-and-data, domain-research |
| **销售/营销** | account-research, call-prep, draft-outreach, create-an-asset, competitive-analysis, competitive-intelligence, campaign-planning, content-creation, brand-voice, performance-analytics |
| **产品** | feature-spec, roadmap-management, metrics-tracking, stakeholder-comms, user-research-synthesis, daily-briefing |
| **法律** | legal-writer, contract-review, nda-triage, compliance, risk-assessment, canned-responses, meeting-briefing |
| **支持** | ticket-triage, escalation, response-drafting, customer-research, knowledge-management |
| **财务** | financial-statements, journal-entry-prep, reconciliation, close-management, audit-support, variance-analysis |

### 1.5 MCP 服务器

| 服务器 | URL | 用途 |
|---|---|---|
| Context7 | `https://mcp.context7.com/mcp` | 库/框架实时文档查询 |

### 1.6 斜杠命令

| 命令 | 文件 | 功能 |
|---|---|---|
| `/autowork` | commands/autowork.md | 自主循环直到 VERIFIED |
| `/autowork-plan` | commands/autowork-plan.md | 仅规划 |
| `/autowork-cancel` | commands/autowork-cancel.md | 取消循环 |
| `/btw` | commands/btw.md | 快捷侧问 |
| `/onboarding` | commands/onboarding.md | 首次引导 |

---

## 2. 缺失能力分析

### 2.1 能力矩阵

| 能力 | 当前 Aether | oh-my-openagent 模式 | 重要性 | 实施难度 |
|---|---|---|---|---|
| **LSP 代码导航** | ❌ 无 | ✅ goto_definition, find_references, rename, diagnostics, symbols | 🔴 关键 | 中 |
| **AST-grep 结构搜索** | ❌ 无 | ✅ 25+ 语言结构化搜索/替换 | 🔴 关键 | 中 |
| **专家 Agent 类型** | ❌ 仅 aether + worker | ✅ Oracle, Metis, Momus 等专家顾问 | 🟡 高 | 低 |
| **Session 连续性** | ⚠️ 部分（agent_spawn 返回 session_id，但无系统化追踪） | ✅ 显式 session_id 管理，70%+ token 节省 | 🟡 高 | 低 |
| **Skill 热加载** | ❌ 需重启 | ✅ 动态发现 + 安装 | 🟡 高 | 中 |
| **自动学习系统** | ❌ 无 | ✅ 从会话提取可重用模式 | 🟢 中 | 高 |
| **哈希锚定编辑** | ❌ 使用行号 | ✅ 内容哈希定位，避免行号偏移 | 🟢 中 | 中 |
| **并行后台 Agent** | ⚠️ 有 agent_spawn(async) 但无专用 explore/librarian 模式 | ✅ explore（代码库 grep）+ librarian（外部参考 grep） | 🟢 中 | 中 |

### 2.2 关键差距解读

#### 差距 1：无精确代码导航（LSP）

当前 Aether agent 只能用 `grep`/`glob` 做代码搜索，这在以下场景力不从心：
- 重构时需要找到某个符号的**所有引用**
- 跳转到函数/类型的**定义位置**
- 在修改前检查文件的**编译错误**
- 安全地**重命名**一个跨文件使用的符号

LSP 工具能将代码编辑的准确率从 ~80% 提升到 ~98%。

#### 差距 2：无结构化代码搜索（AST-grep）

`grep` 基于文本匹配，无法理解代码结构。例如：
- 找出所有 `console.log($MSG)` 调用 → grep 可以
- 找出所有 `async function $NAME($$$) { $$$ }` 定义 → grep 无法准确匹配
- 安全替换 `console.log($MSG)` → `logger.info($MSG)` → grep 会破坏注释/字符串中的匹配

AST-grep 支持 25 种语言的结构化匹配和重写。

#### 差距 3：Agent 类型单一

当前只有两种角色：
- **aether**：全能主 agent（工作 + 编排）
- **worker**：执行者（无编排权限）

缺少：
- **Oracle**（只读顾问）：架构决策、复杂调试、2+ 次修复失败后的咨询
- **Metis**（预规划分析）：复杂任务前的范围评估、歧义检测
- **Momus**（质量审查）：计划/代码的严格审查

#### 差距 4：Session 连续性不足

当前 `agent_spawn` 返回 `session_id`，但没有系统化的追踪机制：
- 每次 follow-up 需要手动传递 session_id
- 无法自动恢复中断的 agent 会话
- 子 agent 上下文无法高效复用（每次新建会话 = token 浪费）

---

## 3. 增强路线图

### Phase 1：代码智能工具（最高 ROI）

**目标**：为 Aether agent 添加 LSP + AST-grep 工具

**新增工具（8 个）**：

```
code-intelligence.ts
├── lsp_goto_definition(filePath, line, character)        → 跳转到定义
├── lsp_find_references(filePath, line, character)        → 查找所有引用
├── lsp_prepare_rename(filePath, line, character)         → 检查重命名是否安全
├── lsp_rename(filePath, line, character, newName)        → 跨文件重命名
├── lsp_diagnostics(filePath, severity?)                  → 编译错误/警告
├── lsp_symbols(filePath, scope, query?)                  → 文件/工作区符号搜索
├── ast_grep_search(pattern, lang, globs?)                → 结构化代码搜索
└── ast_grep_replace(pattern, rewrite, lang, dryRun?)     → 结构化代码替换
```

**实现方式**：
1. 新建 `core/aether-master/opencode/plugin/aether-system/code-intelligence.ts`
2. 在 `aether-system.ts` 中加载：`const codeIntel = await load("code-intelligence", ...)`
3. 合并到工具导出：`...(codeIntel?.tool || {})`
4. 在 `agents/aether.md` 和 `agents/worker.md` 的 `permission` 中添加 `allow`

**改动范围**：2 个新文件 + 2 个文件微调（aether-system.ts + 权限声明）

**预期效果**：
- 代码编辑准确率 ~80% → ~98%
- 重构安全性大幅提升
- Agent 能理解代码结构，不再依赖文本猜测

### Phase 2：专家 Agent 层

**目标**：新增 3 个专家 agent 类型，实现多模型协作

**新增 Agent 定义**：

```
agents/
├── aether.md     ← 主 agent（已有，微调委派规则）
├── worker.md     ← 执行者（已有，不变）
├── oracle.md     ← 新增：只读顾问
├── metis.md      ← 新增：预规划分析
└── momus.md      ← 新增：质量审查
```

**各 Agent 职责**：

| Agent | 触发时机 | 权限 | 模型建议 |
|---|---|---|---|
| **Oracle** | 架构决策、复杂调试、2+ 次修复失败、安全/性能审查 | 只读（read + grep + glob + web_search） | 高质量推理模型 |
| **Metis** | 复杂任务前的范围评估、歧义检测、多方案比较 | 只读 + session 工具 | 高质量推理模型 |
| **Momus** | 计划完成后的质量审查、代码审查 | 只读 + LSP + AST-grep | 严格审查模型 |

**实现方式**：
1. 新建 3 个 `.md` agent 定义文件
2. 在 `opencode.jsonc` 中注册
3. 在 `agents/aether.md` 的系统 prompt 中添加委派规则
4. 不需要改 TypeScript 代码

**改动范围**：3 个新 `.md` 文件 + 2 个文件微调

**预期效果**：
- 决策质量提升（多视角审查）
- 减少返工（提前发现架构问题）
- 安全性提升（Oracle 审查安全边界）

### Phase 3：Session 连续性 + Skill 管理

**目标**：系统化 session 复用 + 动态技能管理

**新增功能**：

```
增强 agent.ts：
├── session_id 追踪 Map → 自动复用 worker 会话
├── agent_spawn 默认返回 session_id（已有）
├── agent_message 自动查找活跃 session（新增）
└── 断点恢复机制（新增）

新增 skill-manager.ts：
├── skill_install(name, source?)  → 安装技能
├── skill_list(query?)            → 列出已安装技能
├── skill_info(name)              → 技能详情
└── skill_remove(name)            → 卸载技能
```

**改动范围**：2 个新模块 + aether-system.ts 集成

### Phase 4：自动学习系统（远期）

**目标**：从会话中自动提取可重用模式

**新增功能**：
- 会话结束时的模式提取 hook
- 学习结果持久化到 `.aether/learnings/`
- 下次会话自动加载相关 learnings
- 学习质量自评（confidence scoring）

**改动范围**：新模块 + 新 hook + aether-system.ts 集成

---

## 4. 实施策略

### 4.1 Overlay Fork 兼容性

所有增强必须遵循 Overlay Fork 策略：

| 原则 | 做法 |
|---|---|
| 不修改上游包 | 新模块独立文件，aether-system.ts 仅添加 load() 调用 |
| 保持目录名不变 | 新文件放在现有 plugin/aether-system/ 目录内 |
| 向后兼容 | 所有新工具 opt-in，权限声明中 `allow` |
| 上游合并友好 | 改动集中在 load() 调用点，冲突最小 |

### 4.2 实施优先级

```
Phase 1（LSP + AST-grep）  ← 立即实施，2-3 天
  ↓ ROI 最高，改动最小
Phase 2（专家 Agent）       ← 紧随其后，1 天
  ↓ 纯声明式，零代码风险
Phase 3（Session + Skill）  ← 1-2 周
  ↓ 架构性改动，需仔细设计
Phase 4（自动学习）          ← 远期
  ↓ 复杂度高，依赖前 3 个 Phase 的基础设施
```

### 4.3 验证标准

每个 Phase 完成后必须验证：

| 检查项 | 方法 |
|---|---|
| 新工具在 aether agent 中可用 | 在沙箱中测试工具调用 |
| 不破坏现有 worker 行为 | 回归测试：worker 仍可正常 spawn/message/stop |
| 上游合并不冲突 | `git merge upstream/main --no-commit --dry-run` |
| LSP 诊断在新工具修改后通过 | `pnpm build` 零错误 |

---

## 5. 附录：oh-my-openagent vs aether-system 详细对比

### 5.1 工具对比

| 工具类别 | aether-system | oh-my-openagent 模式 | 差距 |
|---|---|---|---|
| 文件操作 | ✅ read, edit, write, glob, grep, morph_edit | ✅ read, edit, write, glob, grep, hash-anchored edit | 编辑精度 |
| Shell | ✅ bash + PTY | ✅ bash + PTY | 相当 |
| 代码导航 | ❌ 仅 grep | ✅ LSP (goto_def, references, rename, diagnostics) | 🔴 关键差距 |
| 结构搜索 | ❌ 仅 regex grep | ✅ AST-grep (25+ 语言) | 🔴 关键差距 |
| Web | ✅ web_search, scrape, image_search, context7 | ✅ web_search, scrape, context7, exa | 相当 |
| Agent 编排 | ✅ agent_spawn/message/stop/status | ✅ agent_spawn/message/stop/status + explore/librarian/oracle | 专家类型 |
| 任务管理 | ✅ task_create/list/update/done/delete | ✅ task_create/list/update/done/delete | 相当 |
| 项目管理 | ✅ project_create/list/get/update/delete/select | ✅ project_create/list/get/update/delete/select | 相当 |
| 会话管理 | ✅ session_list/get/search/lineage/stats | ✅ session_list/get/search/lineage/stats + 连续性追踪 | 连续性 |
| 触发器 | ✅ cron + webhook | ❌ 无 | Aether 更强 |
| 连接器 | ✅ connector CRUD + Pipedream OAuth | ❌ 无 | Aether 更强 |
| PTY | ✅ spawn/read/write/kill/list | ✅ spawn/read/write/kill/list | 相当 |
| Worktree | ✅ create/delete | ✅ create/delete | 相当 |
| Skills | ✅ 40+ 预装 | ✅ 40+ 预装 + 动态安装 | Skill 管理 |

### 5.2 结论

**aether-system 在基础设施层面更完善**（触发器、连接器、Channels、Share、Deployments），但**在代码智能层面有显著差距**（LSP、AST-grep、专家 Agent）。

**最佳策略**：保留 aether-system 的所有基础设施能力，增量添加 oh-my-openagent 模式中的代码智能和专家 Agent 能力。不要替换，要增强。

---

## 6. 相关文件索引

### 6.1 核心文件

| 文件 | 职责 |
|---|---|
| `core/aether-master/opencode/plugin/aether-system/aether-system.ts` | 插件主入口（137 行） |
| `core/aether-master/opencode/plugin/aether-system/agent.ts` | Agent 生命周期（527 行） |
| `core/aether-master/opencode/plugin/aether-system/tasks.ts` | 任务管理 |
| `core/aether-master/opencode/plugin/aether-system/projects.ts` | 项目管理 |
| `core/aether-master/opencode/plugin/aether-system/sessions.ts` | 会话管理 |
| `core/aether-master/opencode/plugin/aether-system/connectors.ts` | 连接器管理 |
| `core/aether-master/opencode/plugin/aether-system/pty-tools.ts` | PTY 工具 |
| `core/aether-master/opencode/plugin/aether-system/autowork/` | Autowork 循环 |
| `core/aether-master/opencode/plugin/aether-system/worktree/` | Worktree 管理 |
| `core/aether-master/opencode/plugin/aether-system/btw.ts` | /btw 快捷问答 |
| `core/aether-master/opencode/plugin/aether-system/auth.ts` | Anthropic 认证 |
| `core/aether-master/opencode/plugin/aether-system/triggers.ts` | 触发器 |

### 6.2 Agent 定义

| 文件 | 职责 |
|---|---|
| `core/aether-master/opencode/agents/aether.md` | 主 agent 定义（740 行） |
| `core/aether-master/opencode/agents/worker.md` | Worker agent 定义（149 行） |

### 6.3 配置

| 文件 | 职责 |
|---|---|
| `core/aether-master/opencode/opencode.jsonc` | OpenCode 全局配置（providers, agents, MCP） |
| `core/aether-master/opencode/commands/*.md` | 斜杠命令定义 |

### 6.4 Skills 目录

| 目录 | 内容 |
|---|---|
| `core/aether-master/opencode/skills/AETHER-system/` | agent-browser, agent-tunnel, computer-use, connectors |
| `core/aether-master/opencode/skills/GENERAL-KNOWLEDGE-WORKER/` | 40+ 领域 skills |
