# OpenSandbox 评估：替代 aether-master 沙箱管理可行性分析

> 日期：2026-04-11
> 状态：分析完成，待决策
> 范围：沙箱基础设施层 vs 应用层

---

## 1. 摘要

**结论：OpenSandbox 可以替代基础设施/容器层，但不能替代应用层。建议采用混合架构。**

| 层次 | OpenSandbox | aether-master | 建议 |
|---|---|---|---|
| 容器生命周期（创建/销毁） | ✅ 强 | ✅ 有 | **替代** |
| 资源隔离（CPU/内存/网络） | ✅ 强（gVisor/Kata/Firecracker） | ⚠️ 基础 Docker | **替代** |
| K8s 编排 | ✅ 生产级 BatchSandbox | ❌ 无 | **新增** |
| 文件操作 API | ✅ 有（上传/下载/搜索） | ✅ 有（通过 Hono 路由） | **替代** |
| 命令执行 API | ✅ 有（execd + Jupyter） | ✅ 有（PTY + SSH） | **替代** |
| Agent 运行时（OpenCode） | ❌ 无 | ✅ 核心功能 | **保留** |
| Channels（Telegram/Slack） | ❌ 无 | ✅ 有 | **保留** |
| Triggers（Cron/Webhook） | ❌ 无 | ✅ 有 | **保留** |
| SecretStore | ❌ 无 | ✅ 有 | **保留** |
| Service Manager | ❌ 无 | ✅ 有 | **保留** |
| Share / Proxy | ❌ 无 | ✅ 有 | **保留** |
| Marketplace | ❌ 无 | ✅ 有 | **保留** |
| Project / Task / Agent 管理 | ❌ 无 | ✅ 有 | **保留** |
| 连接器（Pipedream） | ❌ 无 | ✅ 有 | **保留** |

---

## 2. OpenSandbox 架构

### 2.1 项目概况

| 项目 | 信息 |
|---|---|
| GitHub | https://github.com/alibaba/OpenSandbox |
| Stars | ~9,900 |
| 许可证 | Apache 2.0 |
| 创建时间 | 2025-12-17 |
| 语言 | Python（FastAPI Server）+ Go（execd Daemon） |
| CNCF | 已收录 |

### 2.2 四层架构

```
┌─────────────────────────────────────────────────┐
│                 SDKs Layer                       │
│  Python │ Java/Kotlin │ TypeScript │ C#/.NET     │
├─────────────────────────────────────────────────┤
│                 Specs Layer                      │
│  sandbox-lifecycle.yml │ execd-api.yaml          │
│  egress-api.yaml       │ OpenAPI 规范            │
├─────────────────────────────────────────────────┤
│                Runtime Layer                     │
│  FastAPI Server（控制面板）                       │
│  Docker Runtime  │  Kubernetes BatchSandbox      │
├─────────────────────────────────────────────────┤
│            Sandbox Instances Layer               │
│  容器 + execd Daemon（注入） + Jupyter Kernels   │
│  ingress（流量入口）│ egress（网络出口控制）      │
└─────────────────────────────────────────────────┘
```

**通信流：**
- SDK ↔ Server：REST（Lifecycle API）
- SDK ↔ execd：REST（Execution API，文件/命令/代码）
- execd ↔ Jupyter：WebSocket（代码执行）

### 2.3 execd Daemon

- **语言**：Go 1.24+，Beego 框架
- **默认端口**：44772
- **注入方式**：二进制从镜像提取 → volume 挂载 → 覆盖 entrypoint
- **启动序列**：Jupyter Server → execd → 用户 entrypoint
- **支持内核**：Python（IPython）、Java（IJava）、JavaScript、TypeScript、Go、Bash
- **性能**：`/ping` < 1ms，文件上传（1MB）10-50ms，代码执行 50-200ms

---

## 3. 十大维度详细对比

### 3.1 仓库结构

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| 语言 | Python + Go | TypeScript（Hono） |
| 框架 | FastAPI + Beego | Hono |
| 设计模式 | 协议优先（OpenAPI Specs） | 代码优先 |
| SDK | 多语言官方 SDK | 无独立 SDK |
| 示例 | 20+ 集成示例 | 无 |

### 3.2 沙箱生命周期

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| 状态机 | Pending → Running → Paused → Stopping → Terminated/Failed | Docker 容器生命周期 |
| 创建 API | `POST /sandboxes`（异步供应） | Docker Compose + s6 服务管理 |
| TTL | ✅ 内置，支持续期 | ❌ 无内置 |
| 暂停/恢复 | ✅ Docker 模式支持 | ❌ 无 |
| 端点发现 | `GET /sandboxes/{id}/endpoints` | Docker 端口映射 |

### 3.3 隔离模型

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| Docker | ✅ 生产级 | ✅ 生产级 |
| Kubernetes | ✅ BatchSandbox Runtime | ❌ 无 |
| gVisor | ✅ 用户态内核 | ❌ 无 |
| Kata Containers | ✅ VM 级隔离 | ❌ 无 |
| Firecracker | ✅ MicroVM | ❌ 无 |
| 网络模式 | Host / Bridge | Docker 默认 |

### 3.4 资源管理

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| CPU/内存限制 | K8s 风格 spec（500m, 512Mi） | Docker 资源限制 |
| 实时监控 | ✅ execd metrics API（SSE 流） | ⚠️ 有限 |
| 性能基准 | 快照 < 10ms，空闲 ~50MB | 未测量 |

### 3.5 网络

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| Ingress | 统一网关 + 路由策略 | Hono Proxy |
| Egress | ✅ 每沙箱策略控制（sidecar） | ❌ 无 |
| 端口暴露 | 动态端点生成 | Docker 端口映射 |
| VNC/桌面 | ✅ 支持 | ✅ WebTop 镜像 |

### 3.6 文件系统

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| 文件操作 | CRUD + 批量上传/下载 + glob 搜索 | Hono 路由 |
| 持久化卷 | OSEP-0003（提案中，有示例） | `/workspace/` 持久卷 |
| 分块传输 | ✅ 支持续传 | ❌ 无 |
| 权限管理 | ✅ chmod | Linux 原生 |

### 3.7 服务管理

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| 入口点 | 用户定义（execd 注入后执行） | s6 服务管理 |
| 后台执行 | ✅ detached + 轮询 | s6 supervision |
| 多进程 | ✅ fork/exec | s6 管理多服务 |
| Web 服务 | Jupyter/VS Code/VNC 示例 | WebTop 镜像 |

### 3.8 多租户

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| 认证 | API Key（`OPEN-SANDBOX-API-KEY`） | INTERNAL_SERVICE_KEY（timing-safe） |
| 元数据标签 | ✅ 用户自定义 + 系统保留 | ❌ 无 |
| 命名空间隔离 | ✅ K8s namespaces | Docker 容器隔离 |
| 自动续期 | OSEP-0009（实验性，Redis） | ❌ 无 |

### 3.9 API/SDK

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| Lifecycle API | REST（1083 行 OpenAPI spec） | Hono 路由（20+ 文件） |
| Execution API | REST（1407 行 OpenAPI spec） | PTY + SSH |
| 官方 SDK | Python / Java / TypeScript / C# | 无 |
| 流式输出 | SSE | SSE（ReadableStream.tee） |

### 3.10 生产就绪度

| 维度 | OpenSandbox | aether-master |
|---|---|---|
| 项目年龄 | ~4 个月 | ~6 个月 |
| Stars | ~9,900 | ~10,000（suna 总体） |
| CI/CD | ✅ E2E + pytest + 集成测试 | ✅ 有 |
| 可观测性 | 结构化日志 + 健康检查 + 指标 | s6 日志 + Docker 日志 |
| 已知限制 | K8s pause/resume 未实现；持久卷提案中 | 单机 Docker 限制 |
| 活跃度 | 非常活跃（79 open issues） | 活跃 |

---

## 4. 可行性分析

### 4.1 OpenSandbox 能替代的部分（基础设施层）

```
当前 aether-master 架构：
┌──────────────────────────────────────┐
│         aether-master（Hono）         │
│  ┌────────────┐  ┌────────────────┐  │
│  │ Docker 管理 │  │ 命令执行（PTY）│  │
│  │ 容器创建    │  │ 文件操作       │  │
│  │ 资源限制    │  │ 端口映射       │  │
│  └────────────┘  └────────────────┘  │  ← OpenSandbox 替代
│  ┌────────────────────────────────┐  │
│  │ Agent Runtime（OpenCode）       │  │
│  │ Channels（Telegram/Slack）      │  │
│  │ Triggers（Cron/Webhook）        │  │
│  │ SecretStore                    │  │
│  │ Service Manager                │  │
│  │ Share / Proxy / Marketplace    │  │
│  │ Project / Task / Agent 管理    │  │
│  │ Connectors（Pipedream）         │  │
│  └────────────────────────────────┘  │  ← aether-master 保留
└──────────────────────────────────────┘
```

### 4.2 混合架构建议

```
┌─────────────────────────────────────────────────┐
│                Aether 控制面板（Pod）               │
│  ┌─────────────────────────────────────────┐     │
│  │  aether-master（精简版）                  │     │
│  │  - Agent Runtime（OpenCode）              │     │
│  │  - Channels（Telegram/Slack）             │     │
│  │  - Triggers（Cron/Webhook）               │     │
│  │  - SecretStore                           │     │
│  │  - Service Manager                       │     │
│  │  - Share / Proxy / Marketplace           │     │
│  │  - Project / Task / Agent 管理           │     │
│  │  - Connectors（Pipedream）                │     │
│  └──────────────────┬──────────────────────┘     │
│                     │ OpenSandbox SDK              │
│  ┌──────────────────▼──────────────────────┐     │
│  │  OpenSandbox Server（基础设施层）         │     │
│  │  - 沙箱生命周期（创建/销毁/暂停/恢复）    │     │
│  │  - 资源隔离（gVisor/Kata/Firecracker）    │     │
│  │  - K8s 编排（BatchSandbox）               │     │
│  │  - 文件操作 API                          │     │
│  │  - 命令执行（execd + Jupyter）           │     │
│  │  - 网络策略（Ingress/Egress）             │     │
│  │  - 多租户隔离                            │     │
│  └──────────────────┬──────────────────────┘     │
│                     │                              │
│  ┌──────────────────▼──────────────────────┐     │
│  │         Sandbox Instances                │     │
│  │  [容器 1: execd + Agent]                 │     │
│  │  [容器 2: execd + Agent]                 │     │
│  │  [容器 N: execd + Agent]                 │     │
│  └─────────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

### 4.3 迁移收益

| 收益 | 描述 |
|---|---|
| **K8s 原生** | 从单机 Docker 升级到 K8s 集群编排，支持水平扩展 |
| **强隔离** | gVisor/Kata/Firecracker 三级安全隔离，多租户更安全 |
| **网络策略** | Egress 控制，防止沙箱间横向渗透 |
| **协议规范** | OpenAPI spec 驱动，多语言 SDK 开箱即用 |
| **资源监控** | 实时 metrics API（SSE 流），性能基准已建立 |
| **代码执行** | execd + Jupyter 多语言内核，比 PTY 更适合 AI Agent |

### 4.4 迁移风险

| 风险 | 缓解措施 |
|---|---|
| 项目年轻（4 个月） | 渐进式迁移，保留回退能力 |
| 持久卷未正式发布 | 使用已有示例（Docker PVC / K8s PVC） |
| K8s pause/resume 未实现 | 暂时使用 Docker runtime |
| OpenCode 注入方式变化 | execd entrypoint 覆盖模式可行 |
| s6 服务管理替代 | 需要重新设计启动序列 |

---

## 5. 实施路线（如采纳）

### Phase 1：评估验证（1-2 周）

- 在独立环境部署 OpenSandbox Server
- 验证 OpenCode Agent 注入 execd 容器的可行性
- 测试文件持久化（Docker PVC / K8s PVC）
- 性能基准对比

### Phase 2：渐进式迁移（2-4 周）

- 新增 `packages/opensandbox-adapter/`（Overlay Fork 策略）
- 实现容器创建/销毁的 OpenSandbox SDK 调用
- 保留 aether-master 应用层不变
- 双模式运行：新沙箱走 OpenSandbox，旧沙箱保持兼容

### Phase 3：应用层适配（2-3 周）

- PTY → execd 命令执行迁移
- 文件操作路由指向 OpenSandbox API
- SecretStore 适配新存储卷
- Service Manager 适配 execd 入口点

### Phase 4：K8s 生产部署（3-4 周）

- BatchSandbox Runtime 配置
- Ingress/Egress 策略定义
- HPA 自动扩缩容
- 监控告警接入

---

## 6. 决策选项

| 选项 | 描述 | 投入 | 风险 |
|---|---|---|---|
| **A. 采纳混合架构** | OpenSandbox 替代基础设施层，aether-master 精简为控制面板 | 高（8-13 周） | 中 |
| **B. 仅借鉴设计** | 不引入 OpenSandbox，参考其网络策略和资源隔离设计改进 aether-master | 低（2-3 周） | 低 |
| **C. 暂缓决策** | 等 OpenSandbox 持久卷正式发布后再评估 | 0 | 无 |
| **D. 保持现状** | 继续使用 aether-master 的 Docker 管理 | 0 | 无 |

---

## 附录 A：OpenSandbox API 速查

### Lifecycle API

| 方法 | 端点 | 功能 |
|---|---|---|
| POST | `/sandboxes` | 创建沙箱 |
| GET | `/sandboxes` | 列出沙箱 |
| GET | `/sandboxes/{id}` | 获取沙箱详情 |
| DELETE | `/sandboxes/{id}` | 删除沙箱 |
| POST | `/sandboxes/{id}/pause` | 暂停 |
| POST | `/sandboxes/{id}/resume` | 恢复 |
| PATCH | `/sandboxes/{id}/ttl` | 续期 |
| GET | `/sandboxes/{id}/endpoints` | 获取端点 |

### Execution API（execd，端口 44772）

| 方法 | 端点 | 功能 |
|---|---|---|
| POST | `/code/execute` | 执行代码 |
| POST | `/command/execute` | 执行命令 |
| GET | `/command/status/{id}` | 命令状态 |
| POST | `/files/upload` | 上传文件 |
| GET | `/files/download` | 下载文件 |
| GET | `/files/info` | 文件信息 |
| POST | `/files/search` | 搜索文件 |
| GET | `/metrics` | 资源指标 |
| GET | `/metrics/watch` | 指标流（SSE） |

## 附录 B：参考链接

- OpenSandbox GitHub: https://github.com/alibaba/OpenSandbox
- OpenSandbox 文档: https://open-sandbox.ai/
- CNCF Landscape: https://landscape.cncf.io/?item=orchestration-management--scheduling-orchestration--opensandbox
- OSEP-0003（持久卷提案）: 仓库 `docs/oseps/` 目录
- OSEP-0009（自动续期）: 仓库 `docs/oseps/` 目录
