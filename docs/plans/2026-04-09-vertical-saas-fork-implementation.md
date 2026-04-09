# 实施计划：垂直行业 SaaS Fork

基于设计文档 `docs/plans/2026-04-09-vertical-saas-fork-design.md` 的实施计划。

## 阶段 1：Rebrand Codemod 脚本（优先级最高）

### 步骤 1.1：创建 rebrand 脚本
- [ ] 创建 `scripts/rebrand.sh`（幂等品牌替换脚本）
- [ ] 支持替换项：包名、环境变量、用户可见文字、cookie 名、API key 前缀、DB schema 名
- [ ] 排除：node_modules、.git、pnpm-lock.yaml、目录名
- [ ] 支持 `BRAND=xxx bash scripts/rebrand.sh` 调用

### 步骤 1.2：创建品牌配置文件
- [ ] 创建 `scripts/rebrand.config.json`（品牌常量定义）
- [ ] 包含：品牌名、大写名、logo 路径、favicon 路径等

### 步骤 1.3：验证 rebrand 脚本
- [ ] 运行脚本（用测试品牌名）
- [ ] `pnpm install && pnpm build` 验证编译通过
- [ ] 检查 import 路径全部替换正确
- [ ] 检查环境变量全部替换正确

**预计耗时**：4-6 小时

---

## 阶段 2：新增垂直行业包

### 步骤 2.1：创建 `packages/vertical/`
- [ ] 初始化 package.json（`@yourbrand/vertical`）
- [ ] 创建 src/index.ts 入口
- [ ] 创建 src/workflows/ 目录（行业工作流）
- [ ] 创建 src/schemas/ 目录（行业数据 schema）
- [ ] 创建 src/prompts/ 目录（行业 Agent prompt）
- [ ] 创建 src/integrations/ 目录（行业集成）
- [ ] 配置 tsconfig.json
- [ ] 添加到 pnpm-workspace.yaml

### 步骤 2.2：创建 `packages/theme/`
- [ ] 初始化 package.json（`@yourbrand/theme`）
- [ ] 创建 src/index.ts 入口
- [ ] 创建 src/colors.ts（品牌色定义）
- [ ] 创建 src/typography.ts（字体定义）
- [ ] 创建 src/assets/ 目录（品牌资源引用）
- [ ] 配置 tsconfig.json
- [ ] 添加到 pnpm-workspace.yaml

**预计耗时**：2-3 小时

---

## 阶段 3：数据库扩展

### 步骤 3.1：创建行业 schema
- [ ] 创建 `packages/db/src/schema/vertical.ts`（行业表定义）
- [ ] 在 `packages/db/src/index.ts` 中导出新 schema
- [ ] 创建 Supabase migration 脚本
- [ ] 不修改 `packages/db/src/schema/acme.ts`

**预计耗时**：2-3 小时

---

## 阶段 4：品牌主题覆盖

### 步骤 4.1：替换品牌资源
- [ ] 替换 `apps/web/public/acme-brandmark-bg.svg` → 你的 logo
- [ ] 替换 favicon
- [ ] 更新 `apps/web/src/app/globals.css` 品牌色变量

### 步骤 4.2：品牌包集成
- [ ] apps/web 的 package.json 添加 `@yourbrand/theme` 依赖
- [ ] 在 apps/web 入口文件中 import theme 包
- [ ] 验证品牌色/字体生效

**预计耗时**：2-3 小时

---

## 阶段 5：上游同步自动化

### 步骤 5.1：GitHub Actions 工作流
- [ ] 创建 `.github/workflows/upstream-sync.yml`
- [ ] 每周一自动 fetch upstream
- [ ] 创建 sync PR（dry-run merge 检测冲突）
- [ ] PR body 包含冲突文件列表

### 步骤 5.2：Merge 后自动化
- [ ] 将 rebrand.sh 集成到 merge 后流程
- [ ] 或创建 `.gitattributes` merge driver（可选）

**预计耗时**：2-3 小时

---

## 阶段 6：垂直行业功能（后续迭代）

### 步骤 6.1：行业 Agent/Tool
- [ ] 在 `core/acme-master/opencode/tools/` 添加行业专用工具
- [ ] 在 `core/acme-master/opencode/plugin/` 添加行业插件
- [ ] 在 `apps/web` 注册工具的 UI 渲染器（ToolRegistry）

### 步骤 6.2：行业 API 路由
- [ ] 在 `apps/api/src/routes/` 添加行业路由文件
- [ ] 在 `apps/api/src/index.ts` 中挂载新路由

### 步骤 6.3：行业工作流 UI
- [ ] 在 `apps/web/src/components/custom/` 添加行业组件
- [ ] 在 `apps/web/src/app/` 添加行业页面

**预计耗时**：视行业需求而定

---

## 总计

| 阶段 | 耗时 | 依赖 |
|---|---|---|
| 1. Rebrand 脚本 | 4-6h | 无 |
| 2. 新增包 | 2-3h | 阶段 1 |
| 3. 数据库扩展 | 2-3h | 阶段 1 |
| 4. 品牌主题 | 2-3h | 阶段 1、2 |
| 5. 同步自动化 | 2-3h | 阶段 1 |
| 6. 行业功能 | TBD | 阶段 1-5 |

**阶段 1-5 总计约 12-18 小时**（2-3 个工作日）

---

## 执行顺序

```
阶段 1 (rebrand 脚本)
  ├── 阶段 2 (新包) ─── 并行 ──┐
  ├── 阶段 3 (数据库) ─ 并行 ──┤
  └── 阶段 5 (自动化) ─ 并行 ──┤
                                ↓
                          阶段 4 (品牌主题)
                                ↓
                          阶段 6 (行业功能 — 后续迭代)
```
