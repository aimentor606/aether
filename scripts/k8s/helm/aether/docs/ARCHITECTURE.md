# Aether K8S Architecture

## Overview

Aether on Kubernetes uses Helm to deploy all services with production-grade configurations. Stateful services are managed by K8S Operators; stateless services use Deployments with HPA autoscaling.

## Architecture Diagram

```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│  Kong Ingress Controller (DB-less)      │
│  LoadBalancer: 80/443                   │
│  TLS termination (cert-manager)         │
│  Plugins: rate-limiting, cors,          │
│           key-auth, prometheus           │
└────┬──────────┬──────────┬──────────────┘
     │          │          │
     ▼          ▼          ▼
/v1/*       /llm/*      /ui/* + /
     │          │          │
     ▼          ▼          ▼
┌─────────┐  ┌──────────────────────┐
│  Aether │  │  LiteLLM Proxy       │
│  API    │  │  (Deployment + HPA)  │
│ (Dep+HPA│  └──────┬──────┬────────┘
│  + PDB) │         │      │
└────┬────┘         │      │
     │         ┌────▼──┐  ┌▼──────────┐
     │         │ Redis │  │ OpenMeter │
     │         │ (SS)  │  │ (optional)│
     │         └───────┘  └┬─────┬────┘
     │                     │     │
┌────▼──────────┐    ┌─────▼──┐ ┌▼──────────┐
│  CNPG         │    │ Kafka  │ │ClickHouse │
│  Postgres 16  │    │Strimzi │ │ (Operator)│
│  3 instances  │    │3 brokers│ │2 replicas │
│  + PgBouncer  │    └────────┘ └───────────┘
│  + S3 Backup  │
└───────────────┘
```

## Service Details

| Component | K8S Resource | Operator/Chart | Replicas | Storage | Purpose |
|-----------|-------------|----------------|----------|---------|---------|
| Aether API | Deployment + HPA + PDB | — | 2-20 | — | Control plane |
| LiteLLM | Deployment + HPA | — | 2-15 | — | LLM proxy (data plane) |
| Kong | Ingress Controller | kong/ingress chart | 2 | — (DB-less) | API gateway + TLS |
| PostgreSQL | Cluster | CloudNativePG | 3 (1P+2R) | 50-100Gi | Primary database |
| PgBouncer | Pooler | CloudNativePG | 2 | — | Connection pooling |
| Redis | StatefulSet | — | 1 | 5-10Gi | Rate limiting + caching |
| Kafka | Kafka CRD | Strimzi | 3 | 20-50Gi | Event streaming |
| ClickHouse | CHI CRD | Altinity | 2 | 50-100Gi | Analytics storage |
| OpenMeter | Deployment | — | 1 | — | Usage metering |
| cert-manager | Deployment | cert-manager | 3 | — | TLS certificate lifecycle |

## Database Layout (CNPG)

The CNPG cluster creates a single Postgres instance with multiple databases:

| Database | Owner | Used By |
|----------|-------|---------|
| aether | aether | Aether API |
| litellm | litellm | LiteLLM proxy |
| openmeter | openmeter | OpenMeter |

Each database user gets its own Secret with connection credentials. Applications connect via PgBouncer pooler (`aether-pg-pooler`) for connection multiplexing.

## SSL / TLS

### Certificate Flow

```
cert-manager watches Certificate CRD
    │
    ├── dev:    SelfSigned ClusterIssuer → signs cert locally
    ├── staging: Let's Encrypt staging   → HTTP-01 challenge via Kong
    └── prod:   Let's Encrypt production → HTTP-01 challenge via Kong
    │
    ▼
TLS Secret (aether-tls) stored in K8S
    │
    ▼
Kong Ingress Controller reads Secret for TLS termination on port 443
```

### HTTP-01 Challenge

For Let's Encrypt (staging/prod), cert-manager creates a temporary Ingress to serve the ACME challenge. Kong serves this on port 80. Requirements:
- Domain DNS points to Kong's LoadBalancer IP
- Port 80 accessible from the internet

## Kong Gateway (DB-less)

All Kong configuration is managed via K8S CRDs — no database needed.

### Plugins

| Plugin | Scope | Purpose |
|--------|-------|---------|
| rate-limiting-control | Control Ingress | 10K/min, Redis-backed |
| rate-limiting-llm | LLM Ingresses | 1K/min, Redis-backed |
| cors-control | Control Ingress | CORS for API routes |
| cors-llm | LLM Ingresses | CORS for LLM routes |
| key-auth | Consumer-level | API key authentication |
| request-termination | Admin block paths | 403 for LiteLLM admin |
| correlation-id | Global | X-Request-ID UUID header |
| prometheus | Global | Metrics collection |

### Ingress Routes

| Path | Backend | Strip Path | Notes |
|------|---------|-----------|-------|
| `/v1` | Aether API | No | Control plane catch-all |
| `/llm` | LiteLLM | Yes | Direct LLM access |
| `/v1/chat/completions` | LiteLLM | No | OpenAI compat |
| `/v1/models` | LiteLLM | No | Model listing |
| `/ui` | LiteLLM | No | Admin UI |
| `/` | LiteLLM | No | Catch-all |

### Consumers

| Consumer | Credential Source | Purpose |
|----------|------------------|---------|
| app-client-01 | `secrets.defaultApiKey` | Production API key |
| app-client-02 | `secrets.premiumApiKey` | Premium/test API key |

## Secret Management

### Auto-Generation

On first `helm install`, empty secret values are auto-generated with `randAlphaNum`. The Secret uses `helm.sh/hook: pre-install` with `lookup` to preserve values across upgrades:

```yaml
# First install: generates random values
# Subsequent upgrades: preserves existing values
{{- with lookup "v1" "Secret" .Namespace .SecretName }}
POSTGRES_PASSWORD: {{ index .data "POSTGRES_PASSWORD" }}
{{- else }}
POSTGRES_PASSWORD: {{ randAlphaNum 32 | b64enc }}
{{- end }}
```

### Secret References

| Consumer | Secret | Key |
|----------|--------|-----|
| Aether API | `aether-pg-app` (CNPG) | `uri` |
| Aether API | `aether-secrets` | `JWT_SECRET`, `REDIS_PASSWORD` |
| LiteLLM | `aether-pg-app` (CNPG) | `uri` |
| LiteLLM | `aether-secrets` | `LITELLM_MASTER_KEY`, provider keys |
| Kong rate-limiting | `aether-secrets` | `REDIS_PASSWORD` (via configFrom) |
| Kong consumers | Per-consumer Secret | `key` |

## Monitoring

### ServiceMonitors

| Target | Port | Path | Interval |
|--------|------|------|----------|
| Aether API | http | /metrics | 30s |
| Kong proxy | metrics | /metrics | 30s |

### PrometheusRules

| Alert | Condition | Severity |
|-------|-----------|----------|
| PodRestartLoop | >5 restarts/hour | warning |
| HighMemoryUsage | >90% memory limit | warning |
| High5xxRate | >5% of requests | critical |

## Backup

### PostgreSQL (CNPG)

- Scheduled daily at 03:00 UTC (when `cnpg.backup.enabled: true`)
- Stored in S3 via BarmanObjectStore
- WAL archiving with gzip compression
- Configure in `values-production.yaml`:

```yaml
cnpg:
  backup:
    enabled: true
    s3:
      bucket: your-pg-backup-bucket
      region: us-east-1
      endpoint: ""  # Optional: for S3-compatible storage
```

### Redis

- CronJob runs BGSAVE daily at 03:00
- RDB snapshot stored on dedicated PVC

## Key Design Decisions

1. **Kong DB-less**: No Kong database. All config via KongPlugin/KongConsumer CRDs. Eliminates a stateful component.
2. **CNPG for Postgres**: Operator handles replication, failover, backups. No manual PG admin needed.
3. **PgBouncer pooler**: Transaction-mode pooling prevents connection exhaustion from API pods.
4. **Redis single-node**: Rate-limiting cache is ephemeral. AOF persistence for restarts. Simplicity over HA.
5. **cert-manager for TLS**: Three modes (self-signed / LE staging / LE prod). Auto-renewal. No manual cert management.
6. **Secret auto-generation**: Empty values → random on first install. `lookup` preserves across upgrades.
7. **Helm chart dependency**: Kong Ingress Controller installed as chart subdependency, not a separate install step.

## Networking

- All inter-service communication uses ClusterIP Services (no host networking).
- Kong is the only ingress point, exposing ports 80/443 via LoadBalancer.
- CNPG pooler (`aether-pg-pooler-rw`) provides a stable DNS name for database connections.
- Redis accessed at `aether-redis-master:6379`.
- Kafka bootstrap at `aether-kafka-kafka-bootstrap:9092`.
