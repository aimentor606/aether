# AetherAI Deployment Guide

Kong OSS + NewAPI/LiteLLM 全栈部署手册。

PG 和 Redis 由共享的 Supabase 栈提供，通过 Docker 网络 `app-network` 连接。

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

Supabase PG 15 ← Kong DB + newapi DB + litellm DB
Supabase Redis  ← newapi cache + rate-limiting
(通过 app-network Docker 网络连接)
```

**容器清单：**

| 容器 | 镜像 | 端口映射 |
|------|------|----------|
| supabase-db | supabase/postgres:15 | 127.0.0.1:5434 → 5432 |
| supabase-redis | redis:7-alpine | 6379 (仅内部网络) |
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
| `ops/.env` | 环境变量（密码、密钥） |
| `core/compose-kong.yml` | Kong Gateway (OSS) 服务 |
| `core/newapi.yml` | newapi 业务服务 |
| `core/litellm.yml` | LiteLLM 代理服务 |
| `core/kong.yml` | Kong Deck 声明式配置（路由/插件/消费者） |
| `supabase/utils/init-deploy-dbs.sh` | 数据库初始化（在共享 PG 中创建 kong/newapi/litellm） |
| `ops/DEPLOYMENT.md` | 本文档 |

---

## 3. 前置条件

- Docker Desktop（已启用 Docker Compose V2）
- Supabase 栈已启动（提供 PG + Redis）

```bash
# 启动 Supabase 栈
docker compose -f scripts/supabase/docker-compose.yml --env-file scripts/supabase/.env up -d

# 初始化部署数据库
bash scripts/supabase/utils/init-deploy-dbs.sh
```

---

## 4. 首次部署（完整流程）

### Step 1: 配置环境变量

```bash
cp ops/.env.example ops/.env
vim ops/.env
```

### Step 2: 创建目录结构

```bash
sudo ops/setup.sh
```

### Step 3: 拉取镜像

```bash
docker pull kong:3.9.1
docker pull calciumion/new-api:v0.12.1
docker pull kong/deck
```

### Step 4: 启动所有容器

```bash
ops/start.sh
```

### Step 5: 初始化 Kong 数据库

```bash
ops/kong-bootstrap.sh
```

### Step 6: 同步 Kong 配置（deck sync）

```bash
ops/sync-kong.sh
```

### Step 7: 验证部署

```bash
ops/verify.sh
```

---

## 5. 日常运维命令

### 启动服务

```bash
ops/start.sh
```

### 停止服务

```bash
ops/stop.sh
```

### 查看状态

```bash
ops/status.sh
```

### 查看日志

```bash
# Kong 日志
ops/logs.sh kong

# LLM 代理日志
ops/logs.sh llm-proxy

# PG/Redis 日志（Supabase 栈）
docker logs supabase-db --tail 100 -f
docker logs supabase-redis --tail 50
```

### 重启单个服务

```bash
ops/restart.sh kong
ops/restart.sh llm-proxy
```

### Deck 同步（应用 kong.yml 配置变更）

```bash
ops/sync-kong.sh
```

### Kong Admin API 查询

```bash
curl -s http://localhost:8001/services | python3 -m json.tool
curl -s http://localhost:8001/routes | python3 -m json.tool
curl -s http://localhost:8001/plugins | python3 -m json.tool
curl -s http://localhost:8001/consumers | python3 -m json.tool
curl -s http://localhost:8001/status | python3 -m json.tool
```

---

## 6. 配置更新流程

### 修改 Kong 路由/插件/消费者

1. 编辑 `core/kong.yml`
2. 运行 `ops/sync-kong.sh`

### 修改环境变量

1. 编辑 `ops/.env`
2. 重启相关容器：`ops/restart.sh`

### 修改 Compose 配置

1. 编辑对应 yml 文件
2. 重新创建容器：`ops/restart.sh`

---

## 7. 验证与测试

### CORS 验证

```bash
curl -X OPTIONS http://localhost:80/api/log \
  -H "Origin: https://www.aimentor.top" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: X-API-Key" \
  -D - -o /dev/null -s
```

### API 认证验证

```bash
# 无 API Key — 应返回 401
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/api/status

# 使用 API Key — 应返回 2xx
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:80/api/status \
  -H "X-API-Key: $DEFAULT_API_KEY"
```

### 前端访问验证

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:80/
# 期望: 200
```

### 健康检查

```bash
ops/verify.sh
```

---

## 8. 监控

### Prometheus 指标

```bash
curl http://localhost:8001/metrics
```

### File-Log 结构化日志

```bash
docker exec kong tail -5 /var/log/kong/file-log.log | python3 -m json.tool
```

---

## 9. 故障排查

### Kong 无法启动

```bash
docker logs kong --tail 50
# 常见原因：1. 数据库未迁移 2. PG 未就绪 3. 端口冲突
```

### Supabase PG 连接失败

```bash
# 检查 supabase-db 健康
docker inspect --format='{{.State.Health.Status}}' supabase-db
# 核对 ops/.env 中的密码与 init-deploy-dbs.sh 一致
```

### 完全重置

```bash
# ⚠️ 危险操作：仅重置部署服务（不影响 Supabase 栈）
ops/reset.sh
# 然后从 Step 4 重新开始
```

---

## 10. 踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `Database needs bootstrapping` | 新数据库需要先运行迁移 | `ops/kong-bootstrap.sh` |
| `path_handling: expected one of: v0, v1` | Kong 3.9 不支持 `v2` | 删除 `path_handling` 字段 |
| `proxy-cache: storage_type unknown` | Kong 3.x 改了字段名 | `storage_type` → `strategy` |
| `env must be prefixed with 'DECK_'` | Deck 安全限制 | kong.yml 中 env 变量加 `DECK_` 前缀 |
| CORS preflight 返回错误服务的头 | 路由不包含 OPTIONS 方法 | 在 route methods 中加入 OPTIONS |
| Kong 连不上 PG | `KONG_PG_*` 变量与 init-deploy-dbs.sh 不一致 | 核对 `ops/.env` 密码 |
