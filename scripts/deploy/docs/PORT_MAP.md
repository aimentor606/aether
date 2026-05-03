# Port Allocation, Password Variables & Storage Paths

## Port Map

### Public-Facing (Deploy Stack)

| Port | Service | Scope | Notes |
|------|---------|-------|-------|
| **80** | Deploy Kong (HTTP) | Public | Production gateway |
| **443** | Deploy Kong (HTTPS) | Public | SSL required |
| **8001** | Deploy Kong Admin | 127.0.0.1 | decK sync, health checks |

### Application Services

| Port | Service | Scope | Notes |
|------|---------|-------|-------|
| **3000** | Next.js Frontend | Host | Dev only (`pnpm dev:web`) |
| **3001** | NewAPI (llm-proxy) | 127.0.0.1 | `LLM_PROXY=newapi` |
| **4000** | LiteLLM (llm-proxy) | 127.0.0.1 | `LLM_PROXY=litellm` |
| **8008** | Aether API | Host | Dev: direct; Prod: via Kong |

### Supabase Platform

| Port | Service | Scope | Notes |
|------|---------|-------|-------|
| **8000** | Supabase Kong HTTP | Host | Auth, Storage, REST gateway |
| **8443** | Supabase Kong HTTPS | Host | |
| **8100** | Supabase Kong Admin | 127.0.0.1 | |
| **5434** | PostgreSQL Direct | Host | Dev/debug tools |
| **5433** | Supavisor Session | Host | Connection pooling |
| **6543** | Supavisor Transaction | Host | Connection pooling |

### OpenMeter (Optional)

| Port | Service | Scope | Notes |
|------|---------|-------|-------|
| **8123** | ClickHouse HTTP | 127.0.0.1 | |
| **8888** | OpenMeter API | 127.0.0.1 | |
| **9092** | Kafka Broker | Docker internal | |
| **9093** | Kafka Controller | Docker internal | KRaft mode |

### Infrastructure (Docker Internal)

| Port | Service | Notes |
|------|---------|-------|
| **5432** | PostgreSQL | Container-to-container on app-network |
| **6379** | Redis | Container-to-container on app-network |

---

## Password Variables

### deploy/ops/.env

| Variable | Format | Used By |
|----------|--------|---------|
| `REDIS_PASSWORD` | hex 16 | Cross-stack: must match supabase/.env |
| `KONG_PG_PASSWORD` | hex 16 | Kong DB user |
| `SESSION_SECRET` | hex 16 | NewAPI session |
| `NEWAPI_DB_PASSWORD` | hex 16 | NewAPI DB user |
| `LITELLM_DB_PASSWORD` | hex 16 | LiteLLM DB user (no `@#/:?%`) |
| `LITELLM_MASTER_KEY` | `sk-` + hex 24 | LiteLLM admin |
| `LITELLM_SALT_KEY` | `sk-` + hex 24 | LiteLLM hash salt |
| `DEFAULT_API_KEY` | `sk-` + hex 24 | Kong consumer (app-client-01) |
| `PREMIUM_KEY` | `sk-` + hex 24 | Kong consumer (app-client-02) |

### supabase/.env (managed separately)

| Variable | Used By |
|----------|---------|
| `POSTGRES_PASSWORD` | All Supabase services |
| `JWT_SECRET` | Auth, REST, Storage, Functions |
| `REDIS_PASSWORD` | **Must match deploy/ops/.env** |

### Generation

```bash
bash ops/gen-secrets.sh > ops/.env   # Auto-generates all passwords
```

---

## Storage Paths

All paths relative to `DATA_ROOT` (`./data` in dev, `/data` in prod).

```
${DATA_ROOT}/
├── kong/cache/          Kong proxy cache
├── uploads/newapi/      NewAPI file uploads
├── clickhouse/          ClickHouse analytics data
├── kafka/               Kafka event stream data
└── logs/
    ├── kong/            Kong access/error logs
    ├── newapi/          NewAPI application logs
    └── litellm/         LiteLLM logs
```

Supabase data lives in `scripts/supabase/volumes/`:
- `volumes/db/data/` — PostgreSQL data
- `volumes/redis/data/` — Redis persistence (RDB + AOF)
- `volumes/storage/` — File storage
