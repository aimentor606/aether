# 基于Aether构建垂直行业SaaS产品 — Fork策略设计

## 文档信息

| 日期 | 版本 | 状态 |
|------|------|------|
| 2026-04-09 | 2.0 | 已确认，进入实施 |

---

## 1. 需求总结

**目标**：基于开源项目 Aether (aimentor606/aether) fork 构建垂直行业 SaaS 产品。

**约束**：
1. 尽量与上游保持同步，上游更新时下游更新成本最小
2. 暂不考虑移动端（减少约 30-40% 工作量）
3. UI + 能力都要定制（全面定制）
4. 定期从上游 merge（每 1-2 周）

**上游项目概况**：
- **仓库**：`aimentor606/aether` → fork 为 `aimentor606/aether`
- **当前差异**：仅 1 个 commit（刚 fork，几乎完全同步）
- **技术栈**：Next.js 15.5 + Hono/Bun API + Expo Mobile + Docker Core + Supabase
- **架构**：pnpm monorepo，`apps/{web, api, mobile}`，`packages/{db, shared, voice, agent-tunnel}`，`core/`

---

## 2. 方案对比

考虑了 3 种方案：

### 方案 A：Overlay Fork（推荐 ✅）

在 fork 内建立清晰的分层：上游代码和定制代码隔离。新功能放新包，UI 用同路径覆盖模式。

- **优势**：初始成本最低；利用已有 plugin/registry 扩展机制；冲突可预测
- **劣势**：merge 时需要解决冲突（集中在 UI 文件）
- **适合**：1-5 人团队，需要深度 UI 定制

### 方案 B：Wrap 模式

不动上游代码，在外面套一层独立服务，用 Docker 镜像运行上游。

- **优势**：零 merge 成本；安全补丁秒级更新
- **劣势**：无法深度 UI 定制；用户看到两套系统
- **放弃原因**：无法满足 "UI + 能力都要改" 的需求

### 方案 C：Subtree 隔离

上游代码作为 git subtree 放在独立目录，定制代码完全在外层。

- **优势**：物理隔离
- **劣势**：需要重写所有 import 路径；初始迁移工作量大
- **放弃原因**：当前 fork 只差 1 个 commit，不值得这么重

---

## 3. 选定方案：Overlay Fork

### 3.1 整体架构

```
aether/ (fork of aimentor606/aether)
├── apps/
│   ├── web/              → UI/品牌/工作流定制（主战场）
│   ├── api/              → 小改：新路由、新中间件、行业逻辑
│   └── mobile/           → 暂不关注（跳过）
├── packages/
│   ├── db/               → 只加文件（新 schema），不改已有表
│   ├── shared/           → 只加导出，不改已有函数签名
│   ├── vertical/          → 🆕 垂直行业核心逻辑
│   └── theme/             → 🆕 品牌主题包
└── core/                 → 不改，用 plugin/tool/skill 机制扩展
```

### 3.2 改动策略

| 层 | 策略 | 冲突风险 | 原因 |
|---|---|---|---|
| `apps/web/src/components/` | 覆盖同路径组件 | 中高 | UI 定制主战场，上游也常改 |
| `apps/web/src/app/` (pages) | 覆盖同路径页面 | 中高 | 工作流定制 |
| `apps/web/src/app/globals.css` | 替换品牌变量 | 中 | 品牌色/字体 |
| `apps/web/src/components/custom/` | 新建目录 | 无 | 独有组件 |
| `apps/api/src/routes/` | 新增路由文件 | 低 | 不碰已有路由 |
| `apps/api/src/middleware/` | 不动已有，可加新的 | 低 | 认证是冲突重灾区 |
| `packages/db/src/schema/` | 新建 vertical.ts | 低 | 不改 acme.ts |
| `packages/vertical/` | 全新包 | 无 | 上游不存在 |
| `packages/theme/` | 全新包 | 无 | 上游不存在 |
| `core/` | 用 plugin 扩展 | 无 | 不动即不冲突 |

### 3.3 新增包设计

#### packages/vertical/ — 垂直行业核心逻辑

```
packages/vertical/
├── package.json
├── src/
│   ├── index.ts          → 包入口
│   ├── workflows/        → 行业工作流定义
│   ├── schemas/          → 行业数据 schema
│   ├── prompts/          → 行业定制 Agent prompt
│   └── integrations/     → 行业专用第三方集成
└── tsconfig.json
```

#### packages/theme/ — 品牌主题包

```
packages/theme/
├── package.json
├── src/
│   ├── index.ts          → 导出品牌常量
│   ├── colors.ts         → 品牌色定义
│   ├── typography.ts     → 字体定义
│   └── assets/           → logo、icon 等品牌资源引用
└── tsconfig.json
```

---

## 4. 上游同步工作流

### 4.1 同步频率

每 1-2 周同步一次。不要攒太久，越久冲突越多。

### 4.2 Merge 操作流程

```bash
# 1. 获取上游最新
git fetch upstream

# 2. 在专用分支上操作
git checkout -b sync-upstream-$(date +%Y%m%d) main

# 3. 执行 merge
git merge upstream/main

# 4. 分类处理冲突
#    A 类 — 你的定制 UI 文件：git checkout --ours <file>
#    B 类 — Schema/API 签名变更：手动合并
#    C 类 — 你的新文件/新包：永不冲突

# 5. 验证
pnpm install && pnpm build

# 6. 提交并合并回 main
git commit -m "chore: sync upstream aimentor606/aether"
git checkout main && git merge sync-upstream-$(date +%Y%m%d)
```

### 4.3 冲突处理原则

| 冲突类型 | 处理方式 |
|---|---|
| 你的 UI 组件 vs 上游 | `git checkout --ours`（保留你的版本） |
| 上游 schema 新增字段 | 手动合并，保留双方改动 |
| 上游 bugfix 你未改的文件 | `git checkout --theirs`（采用上游修复） |
| 你的新包/新文件 | 无冲突 |

### 4.4 冲突量预估

- 每次 merge 约 50 个上游 commit
- 预计 5-10 个文件冲突
- 其中 3-5 个用 `--ours` 快速解决
- 2-3 个需手动合并
- **耗时约 30 分钟到 2 小时**

### 4.5 自动化辅助

建议添加 GitHub Actions 工作流，每周一自动检测上游差异并创建 sync PR。

---

## 5. 跳过移动端的影响

- `apps/mobile/` 完全不动
- 上游更新 mobile 代码时，Git 自动合并（无冲突，因为双方都没改同一区域）
- 工作量减少约 30-40%
- 可专注 Web + API + Core 三层

---

## 6. 核心纪律（减少冲突的关键）

1. **新功能放新文件/新包** — 永远不冲突
2. **不改 `packages/db/src/schema/acme.ts`** — 冲突重灾区，用关联表代替
3. **不改 `apps/api/src/middleware/auth.ts`** — 核心认证逻辑
4. **不改 `core/` 核心运行时** — 用 plugin/tool/skill 机制扩展
5. **数据库扩展用新表** — `packages/db/src/schema/vertical.ts`
6. **定期同步** — 每 1-2 周，别攒太久

---

## 7. 扩展机制利用

Aether 已有以下扩展机制，可以在不改核心代码的情况下添加能力：

| 机制 | 文件位置 | 用途 |
|---|---|---|
| OpenCode Plugin | `core/acme-master/opencode/plugin/` | 添加系统级行为 |
| Tool Registry | `core/acme-master/opencode/tools/` | 添加 Agent 可调用的工具 |
| Frontend ToolRegistry | `apps/web/src/components/session/tool-renderers.tsx` | 注册工具的 UI 渲染器 |
| ToolViewRegistry | `apps/web/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx` | 注册工具视图 |
| Service Manager | `core/acme-master/src/services/service-manager.ts` | 注册运行时服务 |
| Provider Registry | `apps/api/src/providers/registry.ts` | 添加 LLM 提供商 |
| Feature Flags | `apps/web/src/lib/feature-flags.ts` | 通过环境变量控制功能 |
| CSS Variables | `apps/web/src/app/globals.css` | 品牌主题定制 |
| i18n | `apps/web/src/i18n/config.ts` + `apps/web/translations/` | 多语言支持 |

---

## 8. 品牌替换策略（Rebrand Codemod）

### 8.1 核心思路

**保留目录名不动，替换其他所有 "Aether" 关键字。** 用 codemod 脚本自动化，每次 merge 上游后运行一次。

### 8.2 替换范围

**不动（保留原样）**：
- 目录名：`core/acme-master/`、`packages/acme-ocx-registry/`
- Git submodule 引用

**替换（通过 codemod 脚本）**：

| 替换项 | 上游值 | 替换为 | 影响范围 |
|---|---|---|---|
| workspace 包名 | `@acme/db`、`@acme/shared` | `@yourbrand/db`、`@yourbrand/shared` | ~80+ 文件的 import |
| 包名 | `acme-api` | `yourbrand-api` | package.json、pnpm 引用 |
| 环境变量前缀 | `ACME_PUBLIC_*`、`ACME_TOKEN` 等 | `YOURBRAND_PUBLIC_*`、`YOURBRAND_TOKEN` | ~40+ 文件 |
| Auth Cookie | `ACME_SUPABASE_AUTH_COOKIE` | `YOURBRAND_SUPABASE_AUTH_COOKIE` | ~5 文件 |
| 用户可见文字 | "Aether" | 你的品牌名 | ~100+ 文件（前端/i18n） |
| API Key 前缀 | `acme_` | `yourbrand_` | ~3 文件 |
| Docker 镜像名 | `acme/suna:*` | `yourbrand/app:*` | ~5 文件 |
| CLI 命令名 | `acme start` 等 | `yourbrand start` | ~20 文件 |
| DB schema 名 | `acme` | `yourbrand` | ~10 文件 |

### 8.3 Rebrand Codemod 脚本

```bash
#!/bin/bash
# scripts/rebrand.sh
# 每次 merge upstream 后运行
# 用法: BRAND=yourbrand scripts/rebrand.sh

set -euo pipefail

BRAND="${BRAND:?请设置 BRAND 环境变量，例如 BRAND=acme}"
BRAND_CAP="$(echo "$BRAND" | sed 's/^./\U&/')"
BRAND_UPPER="$(echo "$BRAND" | tr '[:lower:]' '[:upper:]')"

echo "🔄 Rebranding: acme → $BRAND"

# --- 第1步：包名替换（package.json + import 语句）---

# package.json 中的 @acme/* 引用
find . -name 'package.json' -not -path '*/node_modules/*' -not -path '*/.next/*' | \
  xargs sed -i '' \
    -e "s/@acme\//@$BRAND\//g" \
    -e "s/\"acme-api\"/\"$BRAND-api\"/g" \
    -e "s/\"acme\"/\"$BRAND\"/g"

# pnpm-workspace.yaml
sed -i '' -e "s/@acme\//@$BRAND\//g" pnpm-workspace.yaml 2>/dev/null || true

# TypeScript/TSX 文件中的 import
find . \( -name '*.ts' -o -name '*.tsx' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/.next/*' \
  -not -path '*/dist/*' | \
  xargs sed -i '' \
    -e "s/@acme\//@$BRAND\//g" \
    -e "s/from ['\"]acme-api/from ['\"]$BRAND-api/g"

# --- 第2步：环境变量替换 ---
find . \( -name '*.ts' -o -name '*.tsx' -o -name '*.env*' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/.next/*' | \
  xargs sed -i '' \
    -e "s/ACME_/$BRAND_UPPER\_/g" \
    -e "s/NEXT_PUBLIC_ACME_/NEXT_PUBLIC_$BRAND_UPPER\_/g"

# --- 第3步：用户可见文字替换（前端）---
find ./apps/web \( -name '*.tsx' -o -name '*.ts' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/.next/*' | \
  xargs sed -i '' \
    -e "s/Aether/$BRAND_CAP/g"

# i18n 翻译文件
find ./apps/web/translations -name '*.json' | \
  xargs sed -i '' "s/Aether/$BRAND_CAP/g"

# --- 第4步：其他固定替换 ---

# Auth cookie
find . \( -name '*.ts' -o -name '*.tsx' \) \
  -not -path '*/node_modules/*' | \
  xargs sed -i '' \
    -e "s/ACME_SUPABASE_AUTH_COOKIE/$BRAND_UPPER\_SUPABASE_AUTH_COOKIE/g"

# API key 前缀
find . -name '*.ts' -not -path '*/node_modules/*' | \
  xargs sed -i '' "s/acme_/$BRAND\_/g"

# DB schema 名（SQL 和 Drizzle）
find . \( -name '*.ts' -o -name '*.sql' \) \
  -not -path '*/node_modules/*' | \
  xargs sed -i '' "s/'acme'/'$BRAND'/g"

# CLI 命令名
find . -name '*.sh' -o -name '*.ts' | \
  xargs sed -i '' "s/acme start/$BRAND start/g; s/acme stop/$BRAND stop/g"

# --- 第5步：品牌资源 ---
# 替换 logo 和 favicon（需手动准备文件）
# cp assets/yourbrand-logo.svg apps/web/public/acme-brandmark-bg.svg
# cp assets/yourbrand-favicon.ico apps/web/public/favicon.ico

echo "✅ Rebrand 完成: acme → $BRAND"
echo "⚠️  请运行 pnpm install && pnpm build 验证"
```

### 8.4 Merge 工作流（更新版）

```bash
# 1. Merge 上游
git fetch upstream
git checkout -b sync-upstream-$(date +%Y%m%d) main
git merge upstream/main

# 2. 解决纯逻辑冲突（5-10 个文件）
#    UI 文件 → git checkout --ours
#    Schema 变更 → 手动合并

# 3. 运行 rebrand 脚本（自动处理品牌替换）
BRAND=yourbrand bash scripts/rebrand.sh

# 4. 验证
pnpm install && pnpm build

# 5. 提交
git add -A
git commit -m "chore: sync upstream + rebrand"
```

### 8.5 冲突量对比

| 场景 | 每次 merge 冲突数 | 解决时间 |
|---|---|---|
| 只改 UI（不替换品牌） | 5-10 个 | 30分钟-2小时 |
| 全替换品牌（手动） | 30-50+ 个 | 半天-一天 |
| **全替换 + codemod 脚本** | **5-10 个（纯逻辑）** | **30分钟-2小时** |

### 8.6 注意事项

1. **rebrand 脚本是幂等的** — 可以重复运行不会出错
2. **需排除的文件** — lock 文件（pnpm-lock.yaml）、node_modules、.git 目录
3. **brand 品牌资源**需手动准备（logo、favicon 等），不在脚本范围内
4. **测试**：rebrand 后必须 `pnpm build` 验证，确保没有遗漏的引用
5. **注释中的 "acme"** 可以不替换（不影响功能，减少 diff 噪音）

---

## 9. 下一步

进入实施计划阶段：

1. 编写并测试 rebrand codemod 脚本
2. 运行初始 rebrand（acme → 你的品牌名）
3. 创建 `packages/vertical/` 和 `packages/theme/` 包
4. 设置品牌主题覆盖（CSS 变量、logo）
5. 配置 GitHub Actions 上游同步自动化
6. 添加行业定制的 Agent/Tool/Skill
