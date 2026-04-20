# OpenSandbox 混合架构 Phase 1 实施计划

> 日期：2026-04-11
> 状态：待实施
> 前置文档：`2026-04-11-opensandbox-evaluation.md`（评估结论：采纳混合架构）
> 预计工期：1-2 周

---

## 1. 架构总览

### 1.1 集成点定位

经过深入分析，集成点 **不在 aether-master 内部**，而是在 API 层的 Provider 抽象：

```
apps/api/src/platform/providers/
├── index.ts              → SandboxProvider 接口定义
├── local-docker.ts       → LocalDockerProvider（当前实现）
└── opensandbox.ts        → OpenSandboxProvider（新建）← 我们要实现的
```

**核心发现**：aether-master **不创建容器**。容器生命周期由 API 层的 Provider 管理。aether-master 运行 **在沙箱内部**，负责应用层逻辑。

### 1.2 混合架构图

```
┌──────────────────────────────────────────────────────┐
│  Aether API（apps/api，Hono）                           │
│  ┌──────────────────────────────────────────────┐    │
│  │  SandboxProvider 接口                         │    │
│  │   ├── ensure()        → 确保沙箱存在且运行    │    │
│  │   ├── create()        → 创建沙箱              │    │
│  │   ├── start/stop()    → 启停沙箱              │    │
│  │   ├── remove()        → 销毁沙箱              │    │
│  │   ├── updateSandbox() → 更新沙箱版本           │    │
│  │   ├── getInfo()       → 获取沙箱信息           │    │
│  │   ├── syncEnv()       → 同步环境变量           │    │
│  │   └── getPorts()      → 获取端口映射           │    │
│  │                                               │    │
│  │  实现：                                       │    │
│  │   ├── LocalDockerProvider（Docker Compose）    │    │
│  │   └── OpenSandboxProvider（OpenSandbox SDK） ← NEW │
│  └──────────────────────────────────────────────┘    │
└───────────────────────┬──────────────────────────────┘
                        │
            ┌───────────┴───────────┐
            │                       │
   ┌────────▼────────┐    ┌────────▼────────┐
   │ LocalDocker     │    │ OpenSandbox     │
   │ Provider        │    │ Provider        │
   │                 │    │                 │
   │ docker compose  │    │ OpenSandbox SDK │
   │ up/down/restart │    │ → Server API    │
   └────────┬────────┘    └────────┬────────┘
            │                       │
   ┌────────▼───────────────────────▼──────────────────┐
   │              Sandbox Container                     │
   │  ┌────────────────────────────────────────────┐   │
   │  │  s6-overlay 服务管理                         │   │
   │  │   ├── svc-aether-master（Hono :8000）       │   │
   │  │   ├── ServiceManager → OpenCode（:4096）    │   │
   │  │   ├── svc-chromium-persistent              │   │
   │  │   ├── svc-sshd                             │   │
   │  │   └── svc-docker（可选 DIND）               │   │
   │  │                                            │   │
   │  │  execd Daemon（OpenSandbox 注入，:44772）   │   │
   │  │                                            │   │
   │  │  /workspace/ → 持久卷                      │   │
   │  │  /run/s6/container_environment/ → 密钥     │   │
   │  └────────────────────────────────────────────┘   │
   └───────────────────────────────────────────────────┘
```

### 1.3 职责划分

| 层 | 负责方 | 职责 |
|---|---|---|
| **沙箱生命周期** | OpenSandbox Server | 创建/销毁/暂停/恢复容器 |
| **资源隔离** | OpenSandbox Server | CPU/内存限制、网络策略 |
| **进程管理** | aether-master（ServiceManager） | OpenCode 启停、端口探测、日志 |
| **密钥注入** | aether-master（SecretStore + sync-s6-env） | 加密存储 → s6 env |
| **Agent 运行时** | OpenCode（ServiceManager spawn） | Agent 会话、工具调用 |
| **持久化** | Docker Volume / K8s PVC | /workspace/ 挂载 |
| **网络代理** | aether-master（Hono proxy） | HTTP/WS → OpenCode |

---

## 2. 前置知识

### 2.1 现有沙箱启动流程

```
docker-compose up
    ↓
ENTRYPOINT /ephemeral/startup.sh
    ↓
startup.sh: 准备 /workspace/ → 修复权限 → 迁移符号链接 → exec s6-overlay
    ↓
s6-overlay /init
    ↓
init-scripts/（按编号排序）:
    95-setup-sshd.sh        → SSH 密钥/配置
    96-fix-bun-pty.sh       → bun-pty 环境变量
    97-secrets-to-s6-env.sh → SecretStore → /run/s6/container_environment/
    98-aether-env.sh        → git 配置、NODE_OPTIONS、工具依赖
    99-restore-packages.sh  → 持久化包恢复
    ↓
s6-services/（按依赖启动）:
    svc-aether-master       → Hono server（port 8000）
    svc-opencode-serve      → 占位（sleep infinity，实际由 ServiceManager 管理）
    svc-chromium-persistent → 浏览器实例
    svc-sshd               → SSH 服务
    svc-docker             → Docker-in-Docker（可选）
    svc-static-web         → 静态文件服务
    svc-lss-sync           → LSS 同步
    ↓
ServiceManager（aether-master 内部）:
    spawn 'opencode-serve' → bash /ephemeral/aether-master/scripts/run-opencode-serve.sh
    waitForPort(4096) → OpenCode 就绪
    ↓
Hono proxy → OpenCode（localhost:4096）
```

### 2.2 SandboxProvider 接口方法

基于 `LocalDockerProvider`（`apps/api/src/platform/providers/local-docker.ts`）分析：

| 方法 | 功能 | LocalDocker 实现 |
|---|---|---|
| `ensure()` | 确保沙箱存在且运行 | docker compose up |
| `create()` | 创建沙箱容器 | docker compose create |
| `start()` | 启动沙箱 | docker compose start |
| `stop()` | 停止沙箱 | docker compose stop |
| `restart()` | 重启沙箱 | docker compose restart |
| `remove()` | 销毁沙箱 | docker compose down |
| `updateSandbox()` | 更新沙箱镜像版本 | pull + recreate |
| `getProvisioningStatus()` | 获取供应状态 | 容器状态查询 |
| `getSandboxInfo()` | 获取沙箱信息 | 容器 inspect |
| `syncCoreEnvVars()` | 同步核心环境变量 | 写入 .env + docker compose |
| `syncTokenToContainer()` | 同步 Token 到容器 | s6 env 文件写入 |
| `getResolvedEndpoints()` | 获取端口映射 | 容器端口映射读取 |

### 2.3 OpenSandbox 部署要求

| 项目 | 值 |
|---|---|
| Server 镜像 | `opensandbox/server:latest` |
| execd 镜像 | `opensandbox/execd:v1.0.10` |
| egress 镜像 | `opensandbox/egress:v1.0.6`（可选） |
| 默认端口 | 8080 |
| 必须挂载 | `/var/run/docker.sock` |
| 配置方式 | TOML 文件 |
| 健康检查 | `GET /health` → `{"status": "healthy"}` |
| API 文档 | `http://localhost:8080/docs`（Swagger UI） |
| 最低 Docker 版本 | 20.10+ |
| Python 版本 | 3.10+（Server） |
| 关键配置 | `pids_limit = 4096`（多沙箱必须） |

### 2.4 OpenSandbox execd 注入机制

```
Server 收到 create sandbox 请求
    ↓
1. 拉取 execd 镜像（opensandbox/execd:v1.0.10）
2. 从镜像中提取 execd 二进制文件到临时目录
3. 创建沙箱容器，附加 volume mount：
   - execd 二进制 → /opt/opensandbox/execd
   - start.sh 脚本 → /opt/opensandbox/start.sh
4. 覆盖容器 entrypoint 为 /opt/opensandbox/start.sh
    ↓
容器启动后 start.sh 执行：
    ├── 启动 Jupyter Server（port 54321）
    ├── 启动 execd daemon（port 44772）
    │   └── 连接 Jupyter WebSocket
    └── 执行用户原始 entrypoint（exec）
```

### 2.5 OpenSandbox TOML 配置

```toml
# OpenSandbox Server 配置
[server]
host = "0.0.0.0"
port = 8080
log_level = "INFO"
api_key = ""                    # 空 = 无认证（开发模式）

[runtime]
type = "docker"                 # 或 "kubernetes"
execd_image = "opensandbox/execd:v1.0.10"

[docker]
network_mode = "bridge"         # "bridge"（推荐）或 "host"
host_ip = "host.docker.internal" # Server 在 Docker 内时需要
pids_limit = 4096               # 多沙箱环境必须
no_new_privileges = true
drop_capabilities = ["AUDIT_WRITE", "MKNOD", "NET_ADMIN"]

[egress]
image = "opensandbox/egress:v1.0.6"
mode = "dns"                    # 网络策略模式

[ingress]
mode = "direct"                 # Docker runtime 用 "direct"

[storage]
# 持久卷配置（OSEP-0003 提案中，有示例）
```

---

## 3. 实施步骤

### Step 1：部署 OpenSandbox Server（本地验证）

**目标**：在本地 Docker 环境启动 OpenSandbox Server，验证基本功能。

**任务**：

1. 创建 `infra/opensandbox/docker-compose.yml`

```yaml
version: '3.8'

services:
  opensandbox-server:
    image: opensandbox/server:latest
    container_name: acme-opensandbox-server
    ports:
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./config.toml:/etc/opensandbox/config.toml:ro
    environment:
      - SANDBOX_CONFIG_PATH=/etc/opensandbox/config.toml
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped
```

2. 创建 `infra/opensandbox/config.toml`

```toml
[server]
host = "0.0.0.0"
port = 8080
log_level = "INFO"

[runtime]
type = "docker"
execd_image = "opensandbox/execd:v1.0.10"

[docker]
network_mode = "bridge"
host_ip = "host.docker.internal"
pids_limit = 4096

[ingress]
mode = "direct"
```

3. 启动并验证

```bash
cd infra/opensandbox
docker compose up -d
curl http://localhost:8080/health
# 期望: {"status": "healthy"}
```

4. 创建测试沙箱

```typescript
// test-sandbox.ts
import { Sandbox } from "opensandbox";

const sandbox = await Sandbox.create(
  "ubuntu:22.04",
  { entrypoint: ["/bin/bash", "-c", "sleep infinity"] }
);
console.log("Sandbox ID:", sandbox.id);
console.log("Endpoints:", await sandbox.endpoints());
await sandbox.delete();
```

**验证标准**：
- [ ] Server 健康检查通过
- [ ] 能创建沙箱
- [ ] 能在沙箱内执行命令
- [ ] 能销毁沙箱
- [ ] Swagger UI 可访问（http://localhost:8080/docs）

### Step 2：读取 SandboxProvider 接口定义

**目标**：精确理解接口签名，确保 OpenSandboxProvider 完全兼容。

**任务**：

1. 读取 `apps/api/src/platform/providers/index.ts` — 接口定义
2. 读取 `apps/api/src/platform/providers/local-docker.ts` — 现有实现参考
3. 记录所有方法签名、参数类型、返回类型
4. 识别哪些方法直接调用 Docker API，哪些通过 docker-compose CLI

**文件列表**：
- `apps/api/src/platform/providers/index.ts`
- `apps/api/src/platform/providers/local-docker.ts`
- `apps/api/src/platform/routes/ssh.ts`（Provider 使用场景）
- `apps/api/src/setup/index.ts`（供应流程）

**验证标准**：
- [ ] 完整的方法签名列表
- [ ] 每个方法的 LocalDocker 实现方式（docker CLI / API）
- [ ] 环境变量和端口映射的数据结构

### Step 3：实现 OpenSandboxProvider

**目标**：创建 `packages/opensandbox-adapter/` 并实现 SandboxProvider 接口。

**Overlay Fork 策略**：新代码在新包中，不修改上游 Provider 接口。

**任务**：

1. 创建包结构

```
packages/opensandbox-adapter/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    → 导出
│   ├── provider.ts                 → OpenSandboxProvider 实现
│   ├── client.ts                   → OpenSandbox Server API 客户端
│   ├── config.ts                   → 配置验证（Zod）
│   ├── sandbox-image.ts            → 自定义镜像管理
│   ├── port-mapper.ts              → 端口映射适配
│   ├── env-sync.ts                 → 环境变量同步（替代 syncTokenToContainer）
│   └── types.ts                    → 类型定义
└── tests/
    ├── provider.test.ts
    ├── client.test.ts
    └── port-mapper.test.ts
```

2. 核心 Provider 方法映射

| SandboxProvider 方法 | OpenSandbox API 对应 |
|---|---|
| `ensure()` | `POST /sandboxes` + 轮询直到 Running |
| `create()` | `POST /sandboxes`（async） |
| `start()` | `POST /sandboxes/{id}/resume` |
| `stop()` | `POST /sandboxes/{id}/pause` |
| `restart()` | `DELETE /sandboxes/{id}` + `POST /sandboxes`（重建） |
| `remove()` | `DELETE /sandboxes/{id}` |
| `updateSandbox()` | `DELETE` + `POST`（新镜像重建） |
| `getProvisioningStatus()` | `GET /sandboxes/{id}` → state 映射 |
| `getSandboxInfo()` | `GET /sandboxes/{id}` + metadata |
| `syncCoreEnvVars()` | 写入 /workspace/.secrets + 触发 sync-s6-env |
| `syncTokenToContainer()` | execd 文件 API 写入 s6 env |
| `getResolvedEndpoints()` | `GET /sandboxes/{id}/endpoints` |

3. 环境变量同步策略

```
当前（LocalDocker）:
  API → 写入 .env 文件 → docker compose 环境变量 → 容器 process.env

OpenSandbox 适配:
  API → OpenSandboxProvider
       → 创建沙箱时传入 env 参数
       → 运行时通过 execd 文件 API 写入 /run/s6/container_environment/
```

4. 端口映射适配

```
当前（LocalDocker）:
  docker-compose.yml: "127.0.0.1:14000:8000"
  config.PORT_MAP 解析 SANDBOX_PORT_MAP

OpenSandbox 适配:
  GET /sandboxes/{id}/endpoints → OpenSandbox 端点格式
  转换为 PORT_MAP 兼容格式:
    {domain}/sandboxes/{id}/port/{port} → localhost:{hostPort}
```

**验证标准**：
- [ ] TypeScript 编译通过
- [ ] 所有 SandboxProvider 方法实现
- [ ] 单元测试通过
- [ ] 类型与 LocalDockerProvider 兼容

### Step 4：构建自定义沙箱镜像

**目标**：基于现有 `core/docker/Dockerfile` 创建兼容 OpenSandbox execd 注入的沙箱镜像。

**挑战**：现有 Dockerfile 有自己的 entrypoint（`/ephemeral/startup.sh` + s6-overlay），OpenSandbox execd 也会覆盖 entrypoint。需要协调两者。

**方案**：创建自定义入口脚本，先启动 execd，再启动 s6。

**任务**：

1. 创建 `core/docker/Dockerfile.opensandbox`（基于现有 Dockerfile）

```dockerfile
# 继承现有构建阶段...
# 在最终阶段添加 OpenSandbox 兼容层

# OpenSandbox execd 入口包装
COPY <<'EOF' /opt/acme-opensandbox-entrypoint.sh
#!/bin/bash
set -e

# 1. 如果 execd 存在（OpenSandbox 注入），启动它
if [ -x /opt/opensandbox/execd ]; then
    /opt/opensandbox/start.sh &
    EXECD_PID=$!
fi

# 2. 执行原始 Aether 启动流程
exec /ephemeral/startup.sh "$@"
EOF
RUN chmod +x /opt/acme-opensandbox-entrypoint.sh

# 设置 entrypoint（OpenSandbox 会覆盖，但我们在创建时指定）
ENTRYPOINT ["/opt/acme-opensandbox-entrypoint.sh"]
```

2. 测试镜像构建

```bash
cd core/docker
docker build -f Dockerfile.opensandbox -t acme/sandbox-opensandbox:latest .
```

3. 验证 execd + s6 共存

```typescript
const sandbox = await Sandbox.create(
  "acme/sandbox-opensandbox:latest",
  {
    entrypoint: ["/opt/acme-opensandbox-entrypoint.sh"],
    env: { ACME_TOKEN: "test", INTERNAL_SERVICE_KEY: "test" }
  }
);
// 等待 aether-master 就绪（port 8000）
// 等待 OpenCode 就绪（port 4096）
```

**验证标准**：
- [ ] 镜像构建成功
- [ ] execd daemon 启动（port 44772 可达）
- [ ] s6-overlay 正常启动
- [ ] aether-master 可达（port 8000）
- [ ] OpenCode 可达（port 4096）
- [ ] /workspace/ 持久化正常

### Step 5：端到端验证

**目标**：完整验证从 API 创建沙箱到 Agent 工作的端到端流程。

**测试场景**：

1. **基础生命周期**
   - [ ] 通过 OpenSandboxProvider 创建沙箱
   - [ ] 沙箱内 aether-master 启动成功
   - [ ] OpenCode 就绪（/session 端点响应）
   - [ ] 销毁沙箱

2. **环境变量注入**
   - [ ] ACME_TOKEN 注入到 s6 env
   - [ ] SecretStore 加密存储正常
   - [ ] OpenCode 获取到正确的环境变量

3. **持久化**
   - [ ] /workspace/ 数据在沙箱重启后保留
   - [ ] Agent 会话历史保留
   - [ ] 秘密数据保留

4. **端口映射**
   - [ ] getResolvedEndpoints() 返回正确映射
   - [ ] HTTP 代理到 OpenCode 正常
   - [ ] WebSocket 代理正常

5. **Agent 功能**
   - [ ] Agent 会话创建
   - [ ] 工具调用（文件读写、命令执行）
   - [ ] PTY 终端工作
   - [ ] 触发器（Cron/Webhook）注册

---

## 4. 关键技术决策（待确认）

| # | 决策 | 选项 A | 选项 B | 建议 |
|---|---|---|---|---|
| 1 | 持久化方案 | OpenSandbox Volume API（OSEP-0003 提案中） | Docker named volume 直接挂载 | **B** — 更成熟稳定 |
| 2 | s6 env 注入 | execd 文件 API 写入 `/run/s6/container_environment/` | 沙箱创建时 env 参数 + init 脚本读取 | **混合** — 创建时传核心变量，运行时用文件 API 更新 |
| 3 | Docker-in-Docker | OpenSandbox 不支持嵌套 Docker | 移除 DIND 依赖或用单独方案 | 需确认 Aether 是否依赖 DIND |
| 4 | 镜像管理 | 每次更新重建镜像 | 挂载 /ephemeral/ 卷动态更新 | **保持现有** — 镜像构建 + volume 覆盖 |
| 5 | 配置切换 | 环境变量 `SANDBOX_PROVIDER=opensandbox` | 配置文件 | **A** — 与现有模式一致 |

---

## 5. 风险与缓解

| 风险 | 影响 | 概率 | 缓解 |
|---|---|---|---|
| execd + s6 入口冲突 | 高 | 中 | 自定义 entrypoint 包装脚本（Step 4） |
| 持久化卷兼容问题 | 高 | 低 | 使用 Docker named volume，跳过 OSEP-0003 |
| 端口映射格式不兼容 | 中 | 中 | port-mapper.ts 适配层转换 |
| OpenSandbox 项目稳定性 | 中 | 低 | 渐进式迁移，保留 LocalDocker 回退 |
| 性能下降（多一层代理） | 低 | 中 | 基准测试对比 |

---

## 6. 文件清单（新建/修改）

### 新建文件

```
infra/opensandbox/
├── docker-compose.yml          → OpenSandbox Server 部署
├── config.toml                 → Server 配置
└── DEPLOYMENT.md               → 部署文档

packages/opensandbox-adapter/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── provider.ts             → OpenSandboxProvider
│   ├── client.ts               → Server API 客户端
│   ├── config.ts               → Zod 配置验证
│   ├── sandbox-image.ts        → 镜像管理
│   ├── port-mapper.ts          → 端口映射适配
│   ├── env-sync.ts             → 环境变量同步
│   └── types.ts
└── tests/
    ├── provider.test.ts
    ├── client.test.ts
    └── port-mapper.test.ts

core/docker/Dockerfile.opensandbox  → OpenSandbox 兼容镜像
core/docker/scripts/acme-opensandbox-entrypoint.sh  → 入口包装脚本
```

### 修改文件（最小化）

```
apps/api/src/platform/providers/index.ts  → 注册 OpenSandboxProvider（条件加载）
apps/api/package.json                     → 添加 opensandbox-adapter 依赖
```

---

## 7. 时间线

| 天 | 任务 | 交付物 |
|---|---|---|
| Day 1 | Step 1: 部署 OpenSandbox Server | Server 运行 + 健康检查通过 |
| Day 2 | Step 2: 读取 SandboxProvider 接口 | 方法签名清单 |
| Day 3-5 | Step 3: 实现 OpenSandboxProvider | provider.ts + 单元测试 |
| Day 6-7 | Step 4: 构建自定义镜像 | Dockerfile.opensandbox + 入口脚本 |
| Day 8-9 | Step 5: 端到端验证 | 验证报告 |
| Day 10 | 文档 + 回归测试 | 更新 DEPLOYMENT.md |
