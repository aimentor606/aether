# AetherAI Deployment Guide

Kong OSS + PostgreSQL + Redis + newapi 全栈部署手册。

---

## 目录

1. [架构概览](#1-架构概览)
2. [文件清单](#2-文件清单)
3. [前置条件](#3-前置条件)
4. [首次部署（完整流程）](#4-首次部署完整流程)
5. [日常运维命令](#5-日常运维命令)
6. [配置更新流程](#6-配置更新流程)
7. [验证与测试](#7-验证与测试)
8. [监控](#8-监控)
9. [故障排查](#9-故障排查)
10. [踩坑记录](#10-踩坑记录)

---

## 1. 架构概览

```
www.aimentor.top (:80/:443)
         │
      Kong OSS (:8000/:8443)
   ┌─────┼──────────┐
/api/*  /v1beta/*    /*
 (svc-api)       (svc-frontend)
 key-auth        proxy-cache
 rate-limit      security headers
 cors            cors
   └─────┼──────────┘
     newapi:3000
   (calciumion/new-api)

PostgreSQL 17 ← Kong DB + newapi DB
Redis 8.6     ← newapi cache
```

**容器清单：**

| 容器 | 镜像 | 端口映射 |
|------|------|----------|
| postgres | postgres:17 | 127.0.0.1:5432 → 5432 |
| redis | redis:8.6 | 6379 (仅内部网络) |
| kong | kong:3.9.1 | 80→8000, 443→8443, 127.0.0.1:8001→8001 |
| newapi | calciumion/new-api:v0.12.1 | 127.0.0.1:3000→3000 |

**Kong 路由规则：**

| 路由 | 路径 | strip_path | 服务 | 插件 |
|------|------|-----------|------|------|
| route-api | `/api` | false | svc-api | key-auth, rate-limiting, cors |
| route-v1beta | `/v1beta` | false | svc-api | key-auth, rate-limiting, cors |
| route-frontend | `/` | false | svc-frontend | proxy-cache, response-transformer, cors |

**全局插件：** correlation-id, prometheus, file-log

---

## 2. 文件清单

| 文件 | 用途 |
|------|------|
| `.env` | 环境变量（密码、密钥） |
| `db.yml` | PostgreSQL 服务 |
| `redis.yml` | Redis 服务 |
| `compose-kong.yml` | Kong Gateway (OSS) 服务 |
| `newapi.yml` | newapi 业务服务 |
| `kong.yml` | Kong Deck 声明式配置（路由/插件/消费者） |
| `kong-deck.sh` | deck 命令别名定义 |
| `init-db/init-kong-db.sql` | 数据库初始化 SQL |
| `DEPLOYMENT.md` | 本文档 |

---

## 3. 前置条件

- Docker Desktop（已启用 Docker Compose V2）
- 本地目录结构（自动创建）：

```bash
mkdir -p logs/postgresql logs/redis logs/kong logs/newapi ssl uploads/newapi config/newapi init-db
```

---

## 4. 首次部署（完整流程）

### Step 1: 拉取镜像

```bash
docker pull kong:3.9.1
docker pull postgres:17
docker pull redis:8.6
docker pull calciumion/new-api:v0.12.1
docker pull kong/deck
```

### Step 2: 创建 Docker 网络

```bash
docker network create app-network
```

### Step 3: 启动所有容器

```bash
docker compose \
  -f db.yml \
  -f redis.yml \
  -f compose-kong.yml \
  -f newapi.yml \
  up -d
```

### Step 4: 等待 PostgreSQL 健康

```bash
# 等待 postgres 健康检查通过
docker compose -f db.yml ps
# 状态应显示 (healthy)
```

### Step 5: 初始化 Kong 数据库

```bash
docker compose -f db.yml -f compose-kong.yml run --rm kong kong migrations bootstrap
```

**预期输出：**
```
Bootstrapping database...
migrating core on database 'kong'...
...
67 migrations processed
67 executed
Database is up-to-date
```

### Step 6: 重启 Kong（加载迁移后的数据库）

```bash
docker restart kong
```

### Step 7: 等待 Kong 健康

```bash
# 等待约 15 秒，确认 kong 状态为 healthy
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml ps
```

### Step 8: 同步 Kong 配置（deck sync）

```bash
# 加载 .env 中的密钥，传递 DECK_ 前缀变量给 deck
source .env && \
export DECK_DEFAULT_API_KEY="$DEFAULT_API_KEY" \
       DECK_PREMIUM_API_KEY="$PREMIUM_API_KEY" && \
docker run --rm \
  -v "$(pwd)":/files \
  -w /files \
  -e DECK_DEFAULT_API_KEY="$DECK_DEFAULT_API_KEY" \
  -e DECK_PREMIUM_API_KEY="$DECK_PREMIUM_API_KEY" \
  kong/deck gateway sync kong.yml \
  --kong-addr http://host.docker.internal:8001
```

**预期输出：**
```
creating consumer app-client-01
creating consumer app-client-02
creating service svc-api
creating service svc-frontend
...
Summary:
  Created: 12
  Updated: 0
  Deleted: 0
```

### Step 9: 验证部署

```bash
# 查看所有容器状态
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml ps

# 测试 CORS preflight — /api/
curl -X OPTIONS http://localhost:80/api/log \
  -H "Origin: https://www.aimentor.top" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-API-Key" \
  -D - -o /dev/null -s

# 测试 CORS preflight — /v1beta/
curl -X OPTIONS http://localhost:80/v1beta/models \
  -H "Origin: https://www.aimentor.top" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-API-Key" \
  -D - -o /dev/null -s

# 测试前端访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/

# 查看 Kong 状态
curl http://localhost:8001/status
```

---

## 5. 日常运维命令

### 启动服务

```bash
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml up -d
```

### 停止服务

```bash
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml down
```

### 查看状态

```bash
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml ps -a
```

### 查看日志

```bash
# Kong 日志
docker logs kong --tail 100 -f

# Kong 访问日志（容器内）
docker exec kong tail -100 /var/log/kong/access.log

# Kong file-log（结构化 JSON）
docker exec kong tail -100 /var/log/kong/file-log.log

# PostgreSQL 日志
docker exec postgres tail -50 /var/log/postgresql/postgresql-*.log

# newapi 日志
docker logs newapi --tail 100 -f

# Redis 日志
docker logs redis --tail 50
```

### 重启单个服务

```bash
docker restart kong
docker restart newapi
docker restart redis
docker restart postgres
```

### Deck 同步（应用 kong.yml 配置变更）

```bash
source .env && \
export DECK_DEFAULT_API_KEY="$DEFAULT_API_KEY" \
       DECK_PREMIUM_API_KEY="$PREMIUM_API_KEY" && \
docker run --rm \
  -v "$(pwd)":/files \
  -w /files \
  -e DECK_DEFAULT_API_KEY="$DECK_DEFAULT_API_KEY" \
  -e DECK_PREMIUM_API_KEY="$DECK_PREMIUM_API_KEY" \
  kong/deck gateway sync kong.yml \
  --kong-addr http://host.docker.internal:8001
```

> **便捷方式：** 也可以将此命令保存为 shell 脚本 `sync-kong.sh`。

### Kong Admin API 查询

```bash
# 查看所有服务
curl -s http://localhost:8001/services | python3 -m json.tool

# 查看所有路由
curl -s http://localhost:8001/routes | python3 -m json.tool

# 查看所有插件
curl -s http://localhost:8001/plugins | python3 -m json.tool

# 查看所有消费者
curl -s http://localhost:8001/consumers | python3 -m json.tool

# 查看 Kong 状态
curl -s http://localhost:8001/status | python3 -m json.tool
```

### Prometheus 指标

```bash
curl -s http://localhost:8001/metrics
```

---

## 6. 配置更新流程

### 修改 Kong 路由/插件/消费者

1. 编辑 `kong.yml`
2. 运行 deck sync（见上方命令）
3. 验证：`curl http://localhost:8001/routes`

### 修改环境变量

1. 编辑 `.env`
2. 重启相关容器：`docker compose -f db.yml -f ... up -d`

### 修改 Compose 配置

1. 编辑对应 yml 文件
2. 重新创建容器：`docker compose -f db.yml -f ... up -d --force-recreate`

---

## 7. 验证与测试

### CORS 验证

```bash
# /api/ 路径 — 应返回 200 + CORS 头
curl -X OPTIONS http://localhost:80/api/log \
  -H "Origin: https://www.aimentor.top" \
  -H "Access-Control-Request-Method: GET" \
  -D - -o /dev/null -s
# 期望: Access-Control-Allow-Origin: https://www.aimentor.top

# /v1beta/ 路径 — 应返回 200 + CORS 头
curl -X OPTIONS http://localhost:80/v1beta/models \
  -H "Origin: https://www.aimentor.top" \
  -H "Access-Control-Request-Method: GET" \
  -D - -o /dev/null -s
# 期望: Access-Control-Allow-Origin: https://www.aimentor.top
```

### API 认证验证

```bash
# 无 API Key — 应返回 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/status
# 期望: 401

# 使用 API Key — 应返回 200
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:80/api/status \
  -H "X-API-Key: sk_live_abc123456789"
# 期望: 200 或后端实际响应码
```

### 前端访问验证

```bash
# 应返回 HTML
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/
# 期望: 200
```

### Rate Limiting 验证

```bash
# 连续请求超过 100 次/分钟会触发限流
for i in $(seq 1 105); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    http://localhost:80/api/status \
    -H "X-API-Key: sk_live_abc123456789"
done
# 后几个请求应返回 429
```

### 健康检查

```bash
# 完整状态一览
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml ps
# 所有容器应为 healthy 或 Up
```

---

## 8. 监控

### Prometheus 指标

Kong 全局 Prometheus 插件已启用，指标端点：

```bash
curl http://localhost:8001/metrics
```

**可用指标：**
- `kong_http_status` — HTTP 状态码计数（按 consumer, service, route）
- `kong_latency_bucket` — 请求延迟分布
- `kong_upstream_health` — 上游健康状态

如需接入 Grafana，配置 Prometheus 抓取 `http://<host>:8001/metrics`。

### File-Log 结构化日志

所有请求以 JSON 格式写入容器内 `/var/log/kong/file-log.log`：

```bash
docker exec kong tail -5 /var/log/kong/file-log.log | python3 -m json.tool
```

**日志字段包括：** request.method, request.uri, request.headers, response.status, latencies, consumer, route, service 等。

---

## 9. 故障排查

### Kong 无法启动

```bash
# 查看日志
docker logs kong --tail 50

# 常见原因：
# 1. 数据库未迁移 → 运行 kong migrations bootstrap
# 2. PostgreSQL 未就绪 → 等待 postgres healthy 后再启动 kong
# 3. 端口冲突 → 检查 80/443/8001 是否被占用
```

### Deck sync 报错

```bash
# 查看详细错误
docker run --rm \
  -v "$(pwd)":/files -w /files \
  -e DECK_DEFAULT_API_KEY="$DECK_DEFAULT_API_KEY" \
  -e DECK_PREMIUM_API_KEY="$DECK_PREMIUM_API_KEY" \
  kong/deck gateway sync kong.yml \
  --kong-addr http://host.docker.internal:8001 \
  --verbose 0

# 常见错误：
# 1. "environment variables must be prefixed with 'DECK_'" → kong.yml 中的 env 必须用 DECK_ 前缀
# 2. "schema violation" → 检查插件配置是否符合 Kong 3.9 文档
# 3. "connect: connection refused" → Kong 未启动或 Admin API 不可达
```

### CORS 不生效

```bash
# 确认路由包含 OPTIONS 方法
curl -s http://localhost:8001/routes | python3 -m json.tool | grep -A5 methods
```

### 容器重启循环

```bash
# 查看退出原因
docker inspect kong --format='{{.State.Error}}'
docker logs kong 2>&1 | tail -20
```

### 完全重置

```bash
# ⚠️ 危险操作：删除所有数据
docker compose -f db.yml -f redis.yml -f compose-kong.yml -f newapi.yml down -v
docker volume prune

# 然后从 Step 1 重新开始
```

---

## 10. 踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `/data/pg/logs is not shared` | macOS Docker 不支持 `/data/` 绝对路径挂载 | 改用项目相对路径 `./logs/postgresql` |
| `Database needs bootstrapping` | 新数据库需要先运行迁移 | `kong migrations bootstrap` |
| `path_handling: expected one of: v0, v1` | Kong 3.9 不支持 `v2` | 删除 `path_handling` 字段（默认 v0） |
| `proxy-cache: storage_type unknown` | Kong 3.x 改了字段名 | `storage_type` → `strategy` |
| `response-transformer: expected a string` | headers 必须是字符串格式 | 使用 `"Key: Value"` 格式 |
| `env must be prefixed with 'DECK_'` | Deck 安全限制 | kong.yml 中 env 变量加 `DECK_` 前缀，运行时传入 |
| CORS preflight 返回错误服务的头 | 路由不包含 OPTIONS 方法 | 在 route methods 中加入 OPTIONS |

---

## 附录: 一键同步脚本

可创建 `sync-kong.sh` 简化 deck sync 操作：

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

source .env
export DECK_DEFAULT_API_KEY="$DEFAULT_API_KEY"
export DECK_PREMIUM_API_KEY="$PREMIUM_API_KEY"

docker run --rm \
  -v "$(pwd)":/files \
  -w /files \
  -e DECK_DEFAULT_API_KEY="$DECK_DEFAULT_API_KEY" \
  -e DECK_PREMIUM_API_KEY="$DECK_PREMIUM_API_KEY" \
  kong/deck gateway sync kong.yml \
  --kong-addr http://host.docker.internal:8001

echo "✅ Kong config synced successfully"
```

```bash
chmod +x sync-kong.sh
./sync-kong.sh
```
