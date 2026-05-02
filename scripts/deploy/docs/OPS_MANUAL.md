# AetherAI 运维手册

**版本**: 1.0  
**更新日期**: 2026-04-09  
**适用环境**: 单节点 Docker 部署

---

## 一、项目概述

AetherAI 是一个基于 Docker 的 AI API 网关平台，由 4 个核心服务组成：

```
                        ┌──────────────┐
                        │   客户端请求   │
                        └──────┬───────┘
                               │
                          :80 / :443
                               │
                      ┌────────▼────────┐
                      │   Kong 3.9.1    │
                      │   (API 网关)     │
                      └───┬─────────┬───┘
                          │         │
                   /api   │         │  /
                  /v1beta │         │  (前端)
                          │         │
                 ┌────────▼──┐  ┌───▼──────────┐
                 │  NewAPI   │  │  NewAPI       │
                 │  v0.12.1  │  │  (前端静态)    │
                 │  :3000    │  │  :3000        │
                 └──┬────┬──┘  └───────────────┘
                    │    │
           ┌───────▼┐  ┌▼────────┐
           │ PG 17  │  │Redis 8.6│
           │ :5432  │  │(内部)    │
           └────────┘  └─────────┘
```

### 组件清单

| 组件 | 版本 | 作用 | 对外端口 |
|------|------|------|----------|
| PostgreSQL | 17 | 主数据库（Kong + NewAPI 共用） | 5432（仅本机） |
| Redis | 8.6 | 缓存 + 会话存储 | 无（仅内部网络） |
| Kong | 3.9.1 | API 网关、路由、认证、限流 | 80/443（公网）、8001（仅本机） |
| NewAPI | v0.12.1 | AI API 聚合业务服务 | 3000（仅本机） |

所有服务通过 Docker 桥接网络 `app-network` 互联。

---

## 二、环境要求

| 项目 | 最低要求 |
|------|----------|
| 操作系统 | Linux（推荐 Ubuntu 22.04+ / Debian 12+） |
| Docker | 24.0+，含 Docker Compose V2 |
| CPU | 2 核 |
| 内存 | 4 GB |
| 磁盘 | `/data` 分区至少 50 GB（SSD 推荐） |
| 网络 | 公网 IP，80/443 端口开放 |

---

## 三、首次部署

### 3.1 获取项目代码

```bash
git clone <仓库地址> /opt/aetherai
cd /opt/aetherai
```

### 3.2 配置环境变量

```bash
cp ops/.env.example ops/.env
vim ops/.env
```

必须修改所有 `CHANGE_ME` 占位符。关键变量说明：

| 变量 | 说明 |
|------|------|
| `DB_ROOT_PASSWORD` | PostgreSQL root 密码 |
| `KONG_PG_PASSWORD` | Kong 数据库用户密码 |
| `NEWAPI_DB_PASSWORD` | NewAPI 数据库用户密码 |
| `REDIS_PASSWORD` | Redis 访问密码 |
| `SESSION_SECRET` | NewAPI 会话密钥 |
| `DEFAULT_API_KEY` | 生产环境 API Key |
| `PREMIUM_API_KEY` | 测试环境 API Key |
| `PUBLIC_HOST` | 公网域名（如 `www.example.com`） |
| `USE_HTTPS` | 是否启用 HTTPS（`true`/`false`） |

> **注意**: `ops/.env` 已在 `.gitignore` 中，不会被提交到版本控制。`supabase/utils/init-deploy-dbs.sh` 中的数据库密码必须与 `.env` 中的 `KONG_PG_PASSWORD` 和 `NEWAPI_DB_PASSWORD` 保持一致——当前需手动同步。

### 3.3 放置 SSL 证书（如启用 HTTPS）

```bash
# 将证书文件放入 ssl/ 目录
cp fullchain.pem ssl/
cp privkey.pem ssl/
```

### 3.4 创建数据目录并设置权限

```bash
sudo ops/setup.sh
```

此脚本会在 `/data/` 下创建完整的目录结构，并设置正确的 UID 属主。

### 3.5 初始化网络和目录

```bash
ops/setup.sh
```

### 3.6 预拉取镜像（可选，推荐）

```bash
ops/pull-images.sh
```

拉取镜像列表：`kong:3.9.1`、`postgres:17`、`redis:8.6`、NewAPI 镜像、`kong/deck`。

### 3.7 启动所有服务

```bash
ops/start.sh
```

脚本会自动加载 `ops/.env`，启动全部 4 个 Compose 文件中定义的服务，等待 10 秒后显示运行状态。

### 3.8 初始化 Kong 数据库

首次启动时，Kong 数据库需要执行迁移：

```bash
ops/kong-bootstrap.sh
```

### 3.9 同步 Kong 路由配置

```bash
ops/sync-kong.sh
```

将 `core/kong.yml` 中的声明式配置同步到 Kong。

### 3.10 验证部署

```bash
ops/verify.sh
```

所有检查通过后，退出码为 0。

---

## 四、日常运维

### 启动服务

```bash
ops/start.sh
```

### 停止服务

```bash
ops/stop.sh
```

### 重启服务

```bash
# 重启全部
ops/restart.sh

# 重启单个服务
ops/restart.sh kong
ops/restart.sh postgres
ops/restart.sh redis
ops/restart.sh newapi
```

### 查看服务状态

```bash
ops/status.sh
```

输出包括：容器运行状态、Kong 已注册路由列表、Kong 已加载插件列表。

### 查看日志

```bash
# 用法: ops/logs.sh <服务名> [行数]
ops/logs.sh kong           # 最近 100 行 + 实时跟踪
ops/logs.sh postgres 200   # 最近 200 行 + 实时跟踪
ops/logs.sh redis
ops/logs.sh newapi
```

### 健康检查

```bash
ops/verify.sh
```

检查项：

| 检查内容 | 方式 |
|----------|------|
| 4 个容器运行状态 | `docker inspect` |
| CORS 预检请求 | `/api/` 和 `/v1beta/` OPTIONS 请求 |
| API 认证 | 无 Key 返回 401，有效 Key 返回 2xx |
| 前端可访问 | `/` 返回 200 |
| Kong Admin API | `localhost:8001` 返回 200 |

---

## 五、备份与恢复

### 自动备份

```bash
ops/backup.sh
```

备份内容：
- PostgreSQL：`newapi` 和 `kong` 两个数据库的 `pg_dump` 导出
- Redis：RDB 快照文件

输出文件：`backups/backup-YYYY-MM-DD-HHMM.tar.gz`

脚本自动清理 7 天前的旧备份。

### 手动恢复 PostgreSQL

```bash
# 1. 解压备份
tar -xzf backups/backup-2026-04-09-1430.tar.gz -C /tmp/restore/

# 2. 恢复 newapi 数据库
docker exec -i aetherai-postgres psql -U newapi -d newapi < /tmp/restore/newapi.sql

# 3. 恢复 kong 数据库
docker exec -i aetherai-postgres psql -U kong -d kong < /tmp/restore/kong.sql
```

### 手动恢复 Redis

```bash
# 1. 停止 Redis
ops/restart.sh redis  # 先停后启会加载新的 RDB

# 2. 替换 RDB 文件
sudo cp /tmp/restore/dump.rdb /data/redis/dump.rdb
sudo chown 999:999 /data/redis/dump.rdb

# 3. 重启 Redis
ops/restart.sh redis
```

### 建议备份策略

| 频率 | 操作 |
|------|------|
| 每日 | 通过 cron 执行 `ops/backup.sh`，保留 7 天 |
| 每周 | 将备份文件同步到异地存储（S3、OSS 等） |

Cron 示例：

```bash
# 每天凌晨 3 点执行备份
0 3 * * * cd /opt/aetherai && ops/backup.sh >> /var/log/aetherai-backup.log 2>&1
```

---

## 六、Kong 网关管理

### 配置文件

声明式配置位于 `core/kong.yml`，由 decK 工具同步到 Kong。

### 同步配置

```bash
ops/sync-kong.sh
```

脚本先检查 Kong Admin API（`localhost:8001`）是否可达，然后通过 Docker 运行 `deck gateway sync`。

### 数据库迁移

Kong 版本升级后需执行：

```bash
ops/kong-bootstrap.sh
```

### 路由与插件概览

**服务定义**：

| 服务名 | 上游地址 |
|--------|----------|
| `svc-api` | NewAPI 后端 API |
| `svc-frontend` | NewAPI 前端静态资源 |

**路由规则**：

| 路径 | 目标服务 |
|------|----------|
| `/api` | svc-api |
| `/v1beta` | svc-api |
| `/` | svc-frontend |

**API 路由插件**：
- `key-auth` — 通过 `X-API-Key` 请求头认证
- `rate-limiting` — 每分钟 100,000 次限流
- `CORS` — 允许来源：`aimentor.top`

**前端路由插件**：
- `proxy-cache` — 5 分钟 TTL 缓存
- `response-transformer` — 安全响应头
- `CORS`

**全局插件**：
- `correlation-id` — 自动添加 `X-Request-ID` 请求追踪头
- `prometheus` — 指标采集
- `file-log` — 文件日志记录

**消费者（API Key 持有者）**：

| 消费者 | 用途 |
|--------|------|
| `app-client-01` | 生产环境 |
| `app-client-02` | 测试环境 |

---

## 七、监控与健康检查

### 容器内置健康检查

| 服务 | 检查命令 | 间隔 |
|------|----------|------|
| PostgreSQL | `pg_isready -U postgres -d postgres` | 10 秒 |
| Redis | `redis-cli ping \| grep PONG` | 10 秒 |
| Kong | `kong health` | 30 秒 |
| NewAPI | `GET http://localhost:3000/api/status`（响应含 `"success": true`） | 30 秒 |

### 日志文件位置

| 服务 | 宿主机路径 | 备注 |
|------|-----------|------|
| PostgreSQL | `/data/logs/postgresql/` | 按天轮转，单文件上限 100MB |
| Redis | `/data/logs/redis/` | 单文件 |
| Kong | `/data/logs/kong/` | 包含 access-log、error-log、admin-log、file-log |
| NewAPI | `/data/logs/newapi/` | 应用日志 |

### PostgreSQL 慢查询

已配置记录执行时间超过 1000ms 的 SQL 语句，日志位于 `/data/logs/postgresql/`。

### Prometheus 指标

Kong 已启用 `prometheus` 插件，可通过 Kong Admin API 获取指标：

```bash
curl http://localhost:8001/metrics
```

---

## 八、故障排查

| 现象 | 可能原因 | 解决方法 |
|------|---------|---------|
| Kong 无法连接 PostgreSQL | supabase-db 未就绪，或 `KONG_PG_*` 变量与 `init-deploy-dbs.sh` 不一致 | 检查 `ops/status.sh` 确认 PG 健康；核对 `ops/.env` 和 `supabase/utils/init-deploy-dbs.sh` 中的密码 |
| 服务启动失败 | Docker 网络不存在 | 执行 `ops/setup.sh`（网络+目录一并初始化） |
| `/data` 目录权限拒绝 | 目录属主不正确 | 执行 `sudo ops/setup.sh` |
| Kong Admin API 不可达 | Admin API 仅监听 `127.0.0.1:8001` | 必须从宿主机本地访问，不可从远程访问 |
| NewAPI 数据库连接失败 | `NEWAPI_DB_*` 环境变量错误 | 核对 `ops/.env`，检查 PostgreSQL 日志 |
| Redis 认证失败 | `REDIS_PASSWORD` 与实际不一致 | 核对 `ops/.env` 中的密码 |
| SSL 证书错误 | 证书文件缺失或过期 | 检查 `ssl/` 目录下是否有有效的 `fullchain.pem` 和 `privkey.pem` |
| `reset.sh` 后 Kong 迁移失败 | PostgreSQL 尚未完全启动 | 等待 PG 健康检查通过后再执行 `ops/kong-bootstrap.sh` |

---

## 九、安全注意事项

### 环境变量管理

- `ops/.env` 包含所有敏感信息（数据库密码、API Key、会话密钥），**严禁提交到版本控制**
- 已通过 `.gitignore` 排除 `ops/.env` 和 `docker.sh`
- 生产环境部署后，建议将 `ops/.env` 文件权限设为 `600`：

```bash
chmod 600 ops/.env
```

### API Key 安全

- `DEFAULT_API_KEY` 和 `PREMIUM_API_KEY` 是 Kong 消费者凭证
- 生产环境必须使用强随机字符串（建议 32 位以上）
- 生成方式：`openssl rand -hex 32`

### 数据库安全

- `supabase/utils/init-deploy-dbs.sh` 中硬编码了数据库用户密码，首次部署前务必修改
- 修改后需同步更新 `ops/.env` 中对应的变量

### 网络隔离

- PostgreSQL（5432）和 NewAPI（3000）仅绑定本机，不暴露到公网
- Kong Admin API（8001）仅绑定本机
- Redis 无宿主机端口映射，仅通过 Docker 内部网络访问

### SSL/TLS

- 生产环境必须启用 HTTPS（`USE_HTTPS=true`）
- 证书文件放置于 `ssl/` 目录
- 建议使用 Let's Encrypt 自动续签，或配合 Certbot 使用

---

## 十、目录结构参考

### 项目目录

```
aetherai/
├── core/                        # Compose 编排文件
│   ├── compose-kong.yml         # Kong 网关服务定义
│   ├── newapi.yml               # NewAPI 服务定义
│   ├── litellm.yml              # LiteLLM 服务定义
│   ├── kong.yml                 # Kong decK 声明式路由配置
│   └── config/newapi/           # NewAPI 应用配置
├── ops/                         # 运维脚本
│   ├── .env                     # 环境变量（不入库）
│   ├── .env.example             # 环境变量模板
│   ├── setup.sh                 # 创建 Docker 网络 + /data 目录 + 权限
│   ├── start.sh                 # 启动服务
│   ├── stop.sh                  # 停止服务
│   ├── restart.sh               # 重启服务
│   ├── status.sh                # 查看状态
│   ├── logs.sh                  # 查看日志
│   ├── verify.sh                # 健康检查
│   ├── backup.sh                # 备份
│   ├── reset.sh                 # 重置（危险）
│   ├── kong-bootstrap.sh        # Kong 数据库迁移
│   ├── sync-kong.sh             # 同步 Kong 配置
│   └── pull-images.sh           # 预拉取镜像
├── ssl/                         # SSL 证书
├── backups/                     # 备份输出
└── docs/                        # 文档
    └── OPS_MANUAL.md            # 本手册
```

### 宿主机数据目录 `/data/`

> PG 和 Redis 数据由 Supabase 栈管理，位于 `scripts/supabase/volumes/`

```
/data/
├── kong/cache/                  # Kong 代理缓存 (UID 1001:1001)
├── uploads/newapi/              # NewAPI 用户上传 (UID 1000:1000)
└── logs/
    ├── kong/                    # Kong 日志 (UID 1001:1001)
    ├── newapi/                  # NewAPI 日志 (UID 1000:1000)
    └── litellm/                 # LiteLLM 日志 (UID 1000:1000)
```

---

## 附录：危险操作速查

| 命令 | 影响 | 是否可恢复 |
|------|------|-----------|
| `ops/reset.sh` | 删除所有容器、数据卷和日志 | 仅通过备份恢复 |
| `ops/kong-bootstrap.sh` | 重置 Kong 数据库 schema | Kong 路由需重新同步 |
| 手动删除 `/data/postgres/` | 丢失全部数据库数据 | 仅通过备份恢复 |

**执行任何危险操作前，务必先运行 `ops/backup.sh`。**
