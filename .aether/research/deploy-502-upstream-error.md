# Deploy 脚本分析："An invalid response was received from the upstream server"

**错误信息**: `Error: An invalid response was received from the upstream server. request_id: f7d41e029ec3763d4ef94708c0439b5d`

**日期**: 2026-04-10

---

## 错误定位

这是 **Kong Gateway 返回的 HTTP 502 Bad Gateway** 错误。含义：Kong 成功接收了客户端请求，但在转发给上游服务（upstream）时，收到了无效或无法解析的 HTTP 响应。

**请求链路**:
```
客户端 → Kong (:80/:443) → llm-proxy (newapi:3000)
```

---

## 根因分析（按可能性排序）

### 🔴 根因 #1：Redis 网络名称不匹配（最可能）

**文件**: `scripts/deploy/core/redis.yml` 第 28-30 行

```yaml
networks:
  app-net:           # ← 注意：这里是 app-net
    external: true
    name: app-network
```

**问题**: 网络定义的 key 是 `app-net`，但外部网络名是 `app-network`。

虽然 `name: app-network` 让它加入了正确的网络，但这里有一个更微妙的问题：所有其他 compose 文件（`db.yml`、`compose-kong.yml`、`newapi.yml`）使用：

```yaml
networks:
  app-network:       # ← key 名称也是 app-network
    external: true
    name: app-network
```

Redis 的 compose file 在 Docker Compose 内部的网络引用 key 是 `app-net`，而其他文件用的是 `app-network`。**当多个 compose 文件被 `docker compose -f ... -f ...` 合并时，如果网络 key 名称不一致，Docker Compose 会将 Redis 放在同一个外部网络但使用不同的内部别名。** 这通常能工作，但如果 Docker Compose 版本有差异，可能导致连通性问题。

**影响链**: newapi 无法连接 Redis → newapi 崩溃或返回错误 → Kong 收到无效响应 → **502**

**修复方案**: 统一网络 key 名称
```yaml
# redis.yml 修改为：
networks:
  app-network:
    external: true
    name: app-network
```

---

### 🔴 根因 #2：llm-proxy (newapi) 容器不健康或崩溃

**文件**: `scripts/deploy/core/newapi.yml`

**可能子原因**:

| 子原因 | 详情 |
|--------|------|
| 数据库连接失败 | `init-db.sql` 中硬编码密码 `aetherai@newapi8864`，但 `.env` 中 `NEWAPI_DB_PASSWORD` 可能已被修改 |
| Redis 连接失败 | 见根因 #1，或 `REDIS_PASSWORD` 不匹配 |
| 镜像拉取失败 | `calciumion/new-api:v0.12.1` 镜像可能不存在或拉不下来 |
| 启动超时 | healthcheck 使用 `start_period` 未设置（newapi.yml 没有 `start_period`），如果启动慢会被标记为 unhealthy |

**验证方法**:
```bash
docker ps -a | grep llm-proxy
docker logs llm-proxy --tail 50
curl -sf http://localhost:3000/api/status
```

---

### 🔴 根因 #3：Kong 路由配置未同步（sync-kong.sh 未运行）

**文件**: `scripts/deploy/ops/sync-kong.sh`

`sync-kong.sh` 根据环境变量 `LLM_PROXY` 决定上游端口：
- `newapi` → 端口 3000
- `litellm` → 端口 4000

如果修改了 `LLM_PROXY` 但没有重新运行 `sync-kong.sh`，Kong 的 upstream target 仍然指向旧端口。

**kong.yml 中的 upstream 定义**:
```yaml
upstreams:
  - name: upstream-aether-api
    targets:
      - target: llm-proxy:${{ env "DECK_LLM_PROXY_PORT" }}  # 端口由 sync-kong.sh 注入
```

**影响**: 如果实际运行的是 litellm（端口 4000）但 Kong 配置指向端口 3000，Kong 连接到错误端口 → 无响应或无效响应 → **502**

---

### 🟡 根因 #4：数据库用户/密码不一致

**文件对比**:

| 文件 | 用户名 | 密码 |
|------|--------|------|
| `init-db/init-db.sql` | `newapi` | `aetherai@newapi8864`（硬编码） |
| `newapi.yml` 默认值 | `${NEWAPI_DB_USER:-newapi}` | `${NEWAPI_DB_PASSWORD:-aetherai@newapi8864}` |
| `docker.sh` 第 2 行 | `ALTER ROLE newapi_user RENAME TO newapi` | — |

**`docker.sh` 第 2 行暴露了一个历史问题**：数据库曾经创建过 `newapi_user` 用户，后来需要手动重命名为 `newapi`。这表明初始化脚本和实际数据库状态可能不一致。

如果用户修改了 `.env` 中的 `NEWAPI_DB_PASSWORD` 但没有更新 `init-db.sql`，newapi 就无法连接数据库。

**影响**: newapi 数据库连接失败 → 服务异常 → **502**

---

### 🟡 根因 #5：前端和 API 都指向同一上游服务

**文件**: `scripts/deploy/core/kong.yml` 第 4-15 行

```yaml
upstreams:
  - name: upstream-aether-api
    targets:
      - target: llm-proxy:${{ env "DECK_LLM_PROXY_PORT" }}  # newapi:3000
        weight: 100

  - name: upstream-aether-frontend
    targets:
      - target: llm-proxy:${{ env "DECK_LLM_PROXY_PORT" }}  # 也是 newapi:3000
        weight: 100
```

**两个 upstream 都指向 `llm-proxy`（即 newapi）**。这意味着：
- `/api/*` 和 `/v1beta/*` → newapi（正确，这是 AI API 聚合服务）
- `/` (前端) → 也是 newapi（依赖 NewAPI 自带的 Web UI）

如果 NewAPI 的 Web UI 功能有问题，访问首页会返回 502。

---

### 🟡 根因 #6：Kong 超时配置可能不足

**文件**: `scripts/deploy/core/kong.yml`

| 服务 | connect_timeout | read_timeout | write_timeout |
|------|----------------|--------------|---------------|
| svc-api | 5000ms | **30000ms** | **30000ms** |
| svc-frontend | 5000ms | 60000ms | 60000ms |

对于 LLM 请求（如 ChatGPT 风格的长响应），30 秒的 read_timeout 可能不够。如果上游处理时间超过 30 秒，Kong 会中断连接并返回错误。

但这个错误消息是 "invalid response"，不是 timeout，所以这是次要因素。

---

## 诊断步骤（生产环境执行）

按顺序执行以下命令定位问题：

```bash
# 1. 检查所有容器状态
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 2. 直接检查 newapi 健康（绕过 Kong）
curl -sf http://localhost:3000/api/status

# 3. 检查 newapi 日志
docker logs llm-proxy --tail 50

# 4. 检查 Kong upstream 状态
curl -s http://localhost:8001/upstreams | python3 -m json.tool

# 5. 检查 Kong 日志
docker exec kong tail -50 /var/log/kong/error.log

# 6. 检查网络连通性
docker network inspect app-network --format '{{range .Containers}}{{.Name}} {{end}}'

# 7. 检查 Redis 可达性
docker exec llm-proxy wget -q -O - http://localhost:3000/api/status 2>&1 || true

# 8. 检查 Kong 当前路由配置
curl -s http://localhost:8001/upstreams/upstream-aether-api/targets | python3 -m json.tool
```

---

## 修复建议

### 优先级 P0（立即修复）

1. **统一 Redis 网络名称** — 修改 `redis.yml` 的 network key 为 `app-network`
2. **验证 llm-proxy 容器健康** — `docker ps` 和 `docker logs llm-proxy`
3. **运行 sync-kong.sh** — 确保配置同步

### 优先级 P1（近期修复）

4. **数据库密码统一管理** — `init-db.sql` 中的硬编码密码应改为从环境变量读取
5. **为 newapi.yml 添加 start_period** — 给 newapi 更多启动时间再开始健康检查

### 优先级 P2（改进）

6. **添加 Kong upstream health checks** — Kong 可配置主动/被动健康检查，自动剔除不健康的 upstream target
7. **增加 API 超时时间** — 对 LLM 请求场景，建议将 `read_timeout` 增加到 120s 或更高
8. **添加 Prometheus 告警** — 监控 502 错误率

---

## 架构依赖图

```
                    ┌──────────────┐
                    │   客户端请求   │
                    └──────┬───────┘
                           │
                      :80 / :443
                           │
                  ┌────────▼────────┐
                  │   Kong 3.9.1    │──── Kong Admin :8001 (localhost only)
                  │   (API 网关)     │
                  └───┬─────────┬───┘
                      │         │
               /api   │         │  /
              /v1beta │         │  (前端)
                      │         │
             ┌────────▼─────────▼┐
             │  NewAPI :3000     │  ← llm-proxy (calciumion/new-api)
             │  (或 LiteLLM)     │
             └──┬─────────────┬──┘
                │             │
         ┌──────▼──┐   ┌─────▼──────┐
         │ PG 17   │   │Redis 8.6   │  ← ⚠️ redis.yml 网络名可能不匹配
         │ :5432   │   │(app-network)│
         └─────────┘   └────────────┘
```
