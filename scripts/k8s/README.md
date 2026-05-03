# Aether K8S Deployment

Self-hosted Kubernetes deployment using Helm Charts and Operators.

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| K8S cluster | v1.28+ | Target cluster |
| kubectl | v1.28+ | Cluster management |
| helm | v3.12+ | Package management |

**Operators** (installed via `make install-operators`):
- [cert-manager](https://cert-manager.io/) — TLS certificate management
- [CloudNativePG](https://cloudnative-pg.io/) — PostgreSQL (CNPG)
- [Strimzi](https://strimzi.io/) — Kafka
- [Altinity ClickHouse Operator](https://github.com/Altinity/clickhouse-operator)
- Kong Ingress Controller (via Helm chart dependency)

## Quick Start

### Development (self-signed SSL)

```bash
make install-operators    # Install operators to cluster
make install-dev          # Install chart with dev defaults
```

Development mode uses self-signed certificates — no public domain or DNS setup needed.

### Production (Let's Encrypt)

```bash
make install-operators

# Set your email + domain
make install

# Or with CLI overrides:
helm install aether helm/aether \
  --namespace aether --create-namespace \
  -f helm/aether/values.yaml \
  -f helm/aether/values-production.yaml \
  --set global.domain=your-domain.com \
  --set ssl.issuerEmail=ops@your-domain.com \
  --set ssl.environment=prod \
  --set litellm.modelList[0].model_name=deepseek-chat \
  --set litellm.modelList[0].litellm_params.model=deepseek/deepseek-chat \
  --set litellm.modelList[0].litellm_params.api_key=os.environ/DEEPSEEK_API_KEY \
  --set secrets.deepseekApiKey=sk-xxx
```

## Configuration

### Files

| File | Purpose |
|------|---------|
| `helm/aether/values.yaml` | Default values (dev environment) |
| `helm/aether/values-production.yaml` | Production overrides |

### Key Values Reference

| Value | Default | Description |
|-------|---------|-------------|
| `global.domain` | `aether.dev` | Public domain |
| `global.namespace` | `aether` | K8S namespace |
| `api.replicas` | `2` | API pod count |
| `api.hpa.maxReplicas` | `10` | API max pods (HPA) |
| `litellm.enabled` | `true` | Enable LiteLLM proxy |
| `litellm.modelList` | `[]` | LLM provider configs |
| `cnpg.instances` | `3` | PG replicas (1P + NR) |
| `cnpg.backup.enabled` | `false` | Enable S3 backups |
| `redis.enabled` | `true` | Enable Redis |
| `kafka.enabled` | `true` | Enable Kafka |
| `openmeter.enabled` | `false` | Enable OpenMeter |
| `monitoring.enabled` | `true` | Enable ServiceMonitors |
| `ssl.enabled` | `true` | Enable HTTPS |
| `ssl.environment` | `dev` | SSL mode: dev/staging/prod |
| `ssl.issuerEmail` | `""` | Let's Encrypt email |

### SSL / TLS

Three certificate modes:

| Mode | `ssl.environment` | Certificate Source | Needs Public Domain | Browser Trust |
|------|-------------------|--------------------|--------------------|--------------|
| Dev (default) | `dev` | cert-manager self-signed | No | No |
| Staging | `staging` | Let's Encrypt staging | Yes | No |
| Production | `prod` | Let's Encrypt production | Yes | Yes |

All certificates auto-renew 30 days before expiry via cert-manager.

```bash
# Dev (default — works locally)
make install-dev

# Staging (test Let's Encrypt flow)
helm install aether helm/aether --set ssl.environment=staging --set ssl.issuerEmail=you@example.com

# Production
helm install aether helm/aether -f values-production.yaml \
  --set ssl.issuerEmail=ops@example.com
```

### Secrets

Secrets are auto-generated on first install and preserved across upgrades (via Helm lookup).

| Secret Key | Auto-Generated | Description |
|------------|---------------|-------------|
| `POSTGRES_PASSWORD` | Yes (32 chars) | Postgres superuser |
| `JWT_SECRET` | Yes (48 chars) | JWT signing key |
| `REDIS_PASSWORD` | Yes (32 chars) | Redis auth |
| `LITELLM_MASTER_KEY` | Yes (sk-32) | LiteLLM admin key |
| `LITELLM_SALT_KEY` | Yes (sk-32) | LiteLLM salt |
| `DEFAULT_API_KEY` | Yes (32 chars) | Kong API key (client-01) |
| `PREMIUM_API_KEY` | Yes (32 chars) | Kong API key (client-02) |
| `CLICKHOUSE_PASSWORD` | Yes (24 chars) | ClickHouse auth |
| `DEEPSEEK_API_KEY` | No | Set per environment |
| `QWEN_API_KEY` | No | Set per environment |
| `ZHIPU_API_KEY` | No | Set per environment |

```bash
# Set explicit values
helm install aether helm/aether \
  --set secrets.postgresPassword=... \
  --set secrets.jwtSecret=... \
  --set secrets.deepseekApiKey=sk-xxx

# View auto-generated secrets
make secrets
```

### LiteLLM Model Configuration

Set model list in `values.yaml`:

```yaml
litellm:
  modelList:
    - model_name: deepseek-chat
      litellm_params:
        model: deepseek/deepseek-chat
        api_key: os.environ/DEEPSEEK_API_KEY
    - model_name: qwen-turbo
      litellm_params:
        model: openai/qwen-turbo
        api_key: os.environ/QWEN_API_KEY
        api_base: https://dashscope.aliyuncs.com/compatible-mode/v1
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make install-operators` | Install all K8S operators |
| `make install` | Helm install (production values) |
| `make install-dev` | Helm install (dev defaults) |
| `make upgrade` | Rolling upgrade |
| `make uninstall` | Remove release |
| `make template` | Render YAML to `/tmp/aether-rendered.yaml` |
| `make lint` | Lint + update dependencies |
| `make status` | Show pods, services, ingress |
| `make backup` | Trigger CNPG backup |
| `make secrets` | Show auto-generated secret keys |

## Directory Structure

```
scripts/k8s/
├── Makefile                          # Convenience commands
├── README.md                         # This file
├── helm/aether/                      # Main Helm Chart
│   ├── Chart.yaml                    # Dependencies: kong/ingress
│   ├── values.yaml                   # Dev defaults
│   ├── values-production.yaml        # Production overrides
│   ├── templates/
│   │   ├── _helpers.tpl              # Template helpers
│   │   ├── secrets.yaml              # Auto-generated secrets
│   │   ├── configmap.yaml            # Non-sensitive config
│   │   ├── api/                      # Aether API (Deployment + HPA + PDB)
│   │   ├── litellm/                  # LiteLLM Proxy (Deployment + HPA)
│   │   ├── kong/                     # Kong Ingress CRDs (plugins + routes)
│   │   ├── cnpg/                     # CloudNativePG (cluster + backup + pooler)
│   │   ├── redis/                    # Redis StatefulSet
│   │   ├── kafka/                    # Strimzi Kafka
│   │   ├── clickhouse/               # ClickHouse Installation
│   │   ├── openmeter/                # OpenMeter (optional)
│   │   ├── cert-manager/             # ClusterIssuer + Certificate
│   │   ├── monitoring/               # ServiceMonitors + PrometheusRules
│   │   └── backup/                   # Redis backup CronJob
│   └── docs/
│       ├── ARCHITECTURE.md
│       └── MIGRATION.md
└── operators/                        # Operator install scripts
    ├── install-cert-manager.sh
    ├── install-cnpg.sh
    ├── install-strimzi.sh
    ├── install-clickhouse.sh
    └── install-kong-ingress.sh
```

## Architecture

See [docs/ARCHITECTURE.md](helm/aether/docs/ARCHITECTURE.md).

## Migration from Docker Compose

See [docs/MIGRATION.md](helm/aether/docs/MIGRATION.md).
