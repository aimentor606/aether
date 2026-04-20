# LiteLLM Infrastructure Deployment Guide

## Overview

This directory contains production-ready infrastructure for the LiteLLM self-hosted proxy deployment:
- `config.yaml` — LiteLLM proxy configuration with 8 models and fallback chains
- `docker-compose.yml` — 4-instance cluster with Redis state management
- `nginx.conf` — Nginx load balancer with SSE support
- `.env.example` — Environment variable template

## Prerequisites

- Docker and Docker Compose (v2.0+)
- Linux/macOS/Windows with Docker support
- Network access to external LLM provider APIs (OpenAI, Azure, Anthropic, AWS, Deepseek, Minimax, Zhi-Pu, Moonshot)
- Shared PostgreSQL database (Aether instance via `DATABASE_URL`)

## Setup

### 1. Configure Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit with your actual credentials
nano .env  # or your preferred editor
```

Required environment variables:
- `LITELLM_MASTER_KEY` — Master API key for proxy authentication
- `DATABASE_URL` — PostgreSQL connection string (shared Aether DB)
- `REDIS_PASSWORD` — Redis authentication password
- Provider API keys (8 total):
  - `OPENAI_API_KEY` — OpenAI API key
  - `AZURE_API_KEY`, `AZURE_API_BASE` — Azure OpenAI credentials
  - `ANTHROPIC_API_KEY` — Anthropic (Claude) API key
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION_NAME` — AWS Bedrock access
  - `DEEPSEEK_API_KEY` — Deepseek API key
  - `MINIMAX_API_KEY` — Minimax API key
  - `ZHI_PU_API_KEY` — Zhi-Pu (GLM) API key
  - `MOONSHOT_API_KEY` — Moonshot (Kimi) API key

### 2. Start the Cluster

```bash
# Pull latest images
docker-compose pull

# Start all services (Redis, 4 LiteLLM instances, Nginx)
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View logs (single service)
docker-compose logs -f litellm-1
docker-compose logs -f nginx
docker-compose logs -f redis
```

### 3. Verify Deployment

```bash
# Health check endpoint (should return 200)
curl http://localhost:4000/health

# Proxy endpoint for testing
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Test streaming (SSE)
curl -N -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LITELLM_MASTER_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello"}],
    "stream": true
  }'
```

## Architecture

### Load Balancing
- **Strategy**: `least_conn` (least number of active connections)
- **Backends**: 4 LiteLLM instances on ports 4001-4004 (exposed as 4000 via Nginx)
- **Health Checks**: Every 30 seconds, 10-second timeout, 3 consecutive failures to mark down
- **Failover**: Automatic, no manual intervention needed

### Model Configuration
All 8 models configured with intelligent fallback chains:

| Model | Primary Provider | Fallback | Use Case |
|-------|------------------|----------|----------|
| `gpt-4o` | OpenAI | Azure OpenAI | Advanced reasoning |
| `claude-sonnet-4-20250514` | Anthropic | AWS Bedrock | Long-context analysis |
| `deepseek-chat` | Deepseek | — | Cost-effective LLM |
| `minimax-m2.7` | Minimax | — | Multimodal tasks |
| `glm-5-turbo` | Zhi-Pu | — | Chinese language |
| `kimi-k2.5` | Moonshot | — | Knowledge synthesis |

### State Management
- **Redis 7-alpine**: Shared cache for multi-instance state
- **Max Memory**: 512MB with `allkeys-lru` eviction
- **Persistence**: `redis_data` volume (survives restarts)
- **Authentication**: Password-protected (env var `REDIS_PASSWORD`)

### Networking
- **Internal Network**: `litellm_network` (bridge)
- **External Access**: Port 4000 (Nginx) → all 4 LiteLLM instances
- **Health Checks**: Internal `/health` endpoint on each instance

## Scaling

### Increase Capacity
To add more LiteLLM instances (e.g., 8 total for 1000+ RPS):

1. Edit `docker-compose.yml`:
   - Add `litellm-5` through `litellm-8` service blocks
   - Increment host ports (4005-4008)

2. Edit `nginx.conf`:
   - Add 4 new upstream servers:
     ```
     server litellm-5:4000 max_fails=3 fail_timeout=30s;
     server litellm-6:4000 max_fails=3 fail_timeout=30s;
     server litellm-7:4000 max_fails=3 fail_timeout=30s;
     server litellm-8:4000 max_fails=3 fail_timeout=30s;
     ```

3. Reload Nginx:
   ```bash
   docker-compose exec nginx nginx -s reload
   ```

### Resource Limits
Current per-instance configuration (in `docker-compose.yml`):
- Memory: 2GB limit, 1GB reservation
- CPU: 2 cores limit, 1 core reservation

Adjust in `resources.limits` and `resources.reservations` as needed.

## Monitoring

### Logs
```bash
# All services
docker-compose logs -f --tail=100

# Single service
docker-compose logs -f litellm-1

# Specific time range
docker-compose logs --since 10m
```

### Metrics
LiteLLM exposes Prometheus metrics at `/metrics`:
```bash
curl http://localhost:4001/metrics  # Or any instance (4002, 4003, 4004)
```

### Performance Baseline
Expected throughput (measured with current config):
- **Single Instance**: ~125 RPS
- **4 Instances**: 500+ RPS
- **Peak Burst**: ~1000 RPS with connection pooling

## Troubleshooting

### Service Won't Start
```bash
# Check Docker daemon
docker ps

# Check compose syntax
docker-compose config

# View startup errors
docker-compose logs redis
docker-compose logs litellm-1
```

### Health Check Failures
```bash
# Test each instance directly
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
curl http://localhost:4004/health

# Check Redis connectivity
docker-compose exec litellm-1 curl http://redis:6379/  # Should fail gracefully
```

### Streaming (SSE) Issues
If streaming doesn't work:
- Verify Nginx `proxy_buffering off` in config (✓ already set)
- Check `proxy_read_timeout 600s` (✓ already set)
- Test with curl `-N` flag for unbuffered output

### High Memory Usage
```bash
# Check Redis memory
docker-compose exec redis redis-cli INFO memory

# Monitor instance memory
docker stats litellm-1 litellm-2 litellm-3 litellm-4

# If needed, adjust maxmemory in docker-compose.yml
```

## Maintenance

### Rebalancing Load
```bash
# Graceful reload (no request drops)
docker-compose exec nginx nginx -s reload
```

### Updating LiteLLM
```bash
# Pull new image
docker-compose pull

# Rolling update (one at a time)
docker-compose up -d litellm-1  # Instance goes down briefly
docker-compose up -d litellm-2
docker-compose up -d litellm-3
docker-compose up -d litellm-4
```

### Backing Up Redis
```bash
# Redis data persists in `redis_data` volume
# To backup:
docker run --rm -v litellm_redis_data:/data -v /backup/path:/backup \
  redis:7-alpine cp /data/dump.rdb /backup/dump.rdb
```

## Production Recommendations

1. **Secrets Management**: Use Docker secrets or a secrets vault (not .env in production)
2. **Monitoring**: Deploy Prometheus + Grafana for metrics
3. **Logging**: Ship logs to centralized logging (ELK, Datadog, CloudWatch)
4. **Backups**: Regular Redis snapshots to durable storage
5. **Updates**: Pin image tags, test in staging before production
6. **Capacity**: Monitor metrics; scale at 70% utilization

## Support

For issues:
1. Check logs: `docker-compose logs -f`
2. Verify environment: `docker-compose config`
3. Test connectivity to providers (API keys valid, no rate limits)
4. Check Redis health: `docker-compose exec redis redis-cli ping`
