# LiteLLM + Kong "no Route matched" 问题分析

**日期**: 2026-04-10
**分析对象**: `8.130.99.204` 部署环境

---

## 问题现象

1. 浏览器访问 `https://8.130.99.204/ui/` → 被重定向到 `/ui/login/?redirect_to=...`
2. LiteLLM UI 操作时出现 **"no Route matched with those values"** 错误

---

## 根因分析

### 问题 1: `/ui/login/` 重定向（实际上正常工作）

URL `https://8.130.99.204/ui/login/?redirect_to=https%3A%2F%2F8.130.99.204%2Fui%2F` 本身是**正常的 LiteLLM 行为**：

1. 用户访问 `/ui/` → Kong 匹配 `route-litellm-ui` → 转发到 `llm-proxy:4000/ui/`
2. LiteLLM 发现未登录 → 307 重定向到 `/ui/login/?redirect_to=原页面URL`
3. 重定向 URL 使用的是公网地址 `8.130.99.99.204`（之前的 Location 重写修复**已生效**）

**结论**：这个重定向不是问题，真正的错误发生在登录/使用 UI 之后的 API 调用。

### 问题 2: "no Route matched with those values"（核心问题）

这是 **Kong 网关**返回的错误，表示请求的路径+方法没有匹配到任何 Kong 路由。

#### Kong 当前路由表

```
路由名               路径       允许方法                    目标服务
──────────────────────────────────────────────────────────────────
route-api           /api       GET/POST/PUT/PATCH/DELETE/OPTIONS  svc-api (key-auth)
route-v1beta        /v1beta    GET/POST/PUT/PATCH/DELETE/OPTIONS  svc-api (key-auth)
route-v1            /v1        GET/POST/PUT/PATCH/DELETE/OPTIONS  svc-api (key-auth)
route-litellm-ui    /ui        所有方法                            svc-litellm-ui (无 key-auth)
route-frontend      /          仅 GET/HEAD/OPTIONS                 svc-frontend
```

#### LiteLLM 管理 API 的真实路径

LiteLLM UI 的前端 JavaScript 会调用以下管理 API：

| LiteLLM 端点 | 用途 | 是否匹配 Kong 路由 |
|---|---|---|
| `POST /user/login` | 用户登录 | ❌ 无匹配 |
| `POST /key/generate` | 创建 API Key | ❌ 无匹配 |
| `GET /key/info` | 查询 Key 信息 | ❌ 无匹配 |
| `GET /model/list` | 列出模型 | ❌ 无匹配 |
| `POST /model/new` | 添加模型 | ❌ 无匹配 |
| `GET /team/list` | 列出团队 | ❌ 无匹配 |
| `GET /health/liveliness` | 健康检查 | ❌ 无匹配 |
| `GET /health/readiness` | 就绪检查 | ❌ 无匹配 |
| `GET /global/spend/keys` | 消费统计 | ❌ 无匹配 |
| `GET /config/list` | 配置列表 | ❌ 无匹配 |
| `GET /v1/chat/completions` | OpenAI 兼容 API | ✅ route-v1 |
| `GET /v1/models` | OpenAI 兼容 API | ✅ route-v1 |
| `GET /ui/*` | UI 静态资源 | ✅ route-litellm-ui |

#### 为什么 NewAPI 没有这个问题

NewAPI 的所有管理端点都在 `/api/*` 路径下：
- `/api/login` → 匹配 route-api ✓
- `/api/user` → 匹配 route-api ✓
- `/api/model` → 匹配 route-api ✓

Kong 配置是为 NewAPI 设计的，LiteLLM 的路径结构与 NewAPI **完全不同**。

#### 请求流失败示意

```
浏览器 → https://8.130.99.204/ui/
  → Kong route-litellm-ui ✅ → LiteLLM 返回登录页 ✅

用户点击登录 → JS 调用 POST /user/login
  → Kong 查找路由:
    /user/login 不匹配 /api, /v1, /v1beta, /ui, /
    → "no Route matched with those values" ❌
```

---

## 解决方案

### 方案 A：在 Kong 中添加 LiteLLM 管理 API 路由（推荐）

在 `kong.yml` 的 `svc-litellm-ui` 服务下添加管理端点路由：

```yaml
# 在 svc-litellm-ui 的 routes 中添加：

- name: route-litellm-key
  paths:
    - /key
  methods:
    - GET
    - POST
    - PUT
    - PATCH
    - DELETE
    - OPTIONS
  strip_path: false

- name: route-litellm-user
  paths:
    - /user
  methods:
    - GET
    - POST
    - PUT
    - PATCH
    - DELETE
    - OPTIONS
  strip_path: false

- name: route-litellm-model
  paths:
    - /model
  methods:
    - GET
    - POST
    - PUT
    - PATCH
    - DELETE
    - OPTIONS
  strip_path: false

- name: route-litellm-team
  paths:
    - /team
  methods:
    - GET
    - POST
    - PUT
    - PATCH
    - DELETE
    - OPTIONS
  strip_path: false

- name: route-litellm-health
  paths:
    - /health
  strip_path: false

- name: route-litellm-config
  paths:
    - /config
  methods:
    - GET
    - POST
    - OPTIONS
  strip_path: false

- name: route-litellm-global
  paths:
    - /global
  methods:
    - GET
    - POST
    - OPTIONS
  strip_path: false

- name: route-litellm-spend
  paths:
    - /spend
  methods:
    - GET
    - POST
    - OPTIONS
  strip_path: false

- name: route-litellm-budget
  paths:
    - /budget
  methods:
    - GET
    - POST
    - OPTIONS
  strip_path: false

- name: route-litellm-customer
  paths:
    - /customer
  methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
  strip_path: false
```

这些路由会继承 `svc-litellm-ui` 上的插件（Host 重写 + Location 重写 + CORS），无需额外配置。

### 方案 B：使用正则路由兜底（备选）

添加一个优先级较低的兜底路由，匹配所有非 API/V1 的路径：

```yaml
- name: route-litellm-catchall
  paths:
    - /key
    - /user
    - /model
    - /team
    - /health
    - /config
    - /global
    - /spend
    - /budget
    - /customer
    - /chat
    - /embeddings
    - /images
  strip_path: false
  tags:
    - litellm-mgmt
```

### 部署步骤

```bash
cd /data/deploy
git pull

# 1. 修改 core/kong.yml（添加上述路由）
# 2. 重新同步 Kong 配置
bash ops/sync-kong.sh

# 3. 验证路由已注册
curl -s http://localhost:8001/services/svc-litellm-ui/routes | python3 -m json.tool

# 4. 测试 LiteLLM UI 完整流程
# 访问 https://8.130.99.204/ui/ → 登录 → 应该正常工作
```

---

## 额外注意事项

1. **SSL 证书**：compose-kong.yml 中 SSL 配置被注释掉了，但端口 443 映射到了 Kong 的 8443 (SSL)。如果没有配置 SSL 证书，HTTPS 请求可能会失败。如果使用了外部 SSL 终结（如 nginx），则无影响。

2. **FORWARDED_ALLOW_IPS**：`litellm.yml` 中虽然设置了 `FORWARDED_ALLOW_IPS=*`，但根据研究（PR #24956 未合并），当前镜像版本中此环境变量不生效。Location 重写依赖 Kong 侧的 post-function 插件。

3. **route-frontend 与 route-litellm-* 的冲突**：`route-frontend` 匹配 `/`（GET/HEAD/OPTIONS），新增的管理路由路径更具体（如 `/key`），Kong 的路由匹配是**最长路径优先**，所以不会冲突。

---

## 总结

| 问题 | 原因 | 严重性 |
|------|------|--------|
| `/ui/login/` 重定向 | LiteLLM 正常登录流程，非 bug | ℹ️ 无需修复 |
| "no Route matched" | Kong 路由只覆盖了 `/api`, `/v1`, `/v1beta`, `/ui`，未覆盖 LiteLLM 管理端点路径 | 🔴 阻塞性 |

**根因一句话**：Kong 路由配置是为 NewAPI 设计的，LiteLLM 的管理 API 使用不同的路径结构（`/key/*`, `/user/*`, `/model/*` 等），这些路径没有对应的 Kong 路由。
