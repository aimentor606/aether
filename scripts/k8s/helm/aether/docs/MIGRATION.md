# Migration: Docker Compose → K8S

## Overview

This guide covers migrating from `scripts/deploy/` Docker Compose to `scripts/k8s/` Helm Chart.

## Key Changes

| Aspect | Docker Compose | K8S Helm |
|--------|---------------|----------|
| Kong mode | DB-mode (postgres) | DB-less (CRDs) |
| Config management | decK + kong.yml | KongPlugin/KongConsumer CRDs |
| PG replication | Single instance | CNPG 3-node (1P + 2R) |
| Connection pooling | None | PgBouncer (transaction mode) |
| Scaling | Manual | HPA (CPU-based autoscaling) |
| Secrets | ops/.env file | K8S Secrets + auto-generation |
| SSL | Manual cert files | cert-manager (self-signed / Let's Encrypt) |
| Backup | cron + shell scripts | CNPG ScheduledBackup to S3 |
| Rate limiting | Kong redis policy (local/redis) | Kong redis policy (redis, via configFrom) |
| Admin API security | Network namespace isolation | Not needed (DB-less, no Admin API) |

## Pre-migration Checklist

- [ ] K8S cluster running (v1.28+)
- [ ] `kubectl` configured and pointing to target cluster
- [ ] `helm` v3.12+ installed
- [ ] DNS configured for target domain (for Let's Encrypt)
- [ ] S3 bucket for PG backups (optional, for production)

## Step 1: Install Operators

```bash
cd scripts/k8s
make install-operators
```

This installs: cert-manager, CloudNativePG, Strimzi, ClickHouse Operator.

## Step 2: Configure Values

Copy and edit production values:

```bash
cp helm/aether/values-production.yaml my-values.yaml
```

Edit `my-values.yaml`:
```yaml
global:
  domain: your-domain.com

ssl:
  issuerEmail: ops@your-domain.com
  environment: staging   # Start with staging, switch to prod after testing

cnpg:
  backup:
    enabled: true
    s3:
      bucket: your-pg-backup-bucket
      region: us-east-1

litellm:
  modelList:
    - model_name: deepseek-chat
      litellm_params:
        model: deepseek/deepseek-chat
        api_key: os.environ/DEEPSEEK_API_KEY

secrets:
  deepseekApiKey: "sk-your-key-here"
```

## Step 3: Install Chart

```bash
helm install aether helm/aether \
  --namespace aether --create-namespace \
  -f helm/aether/values.yaml \
  -f my-values.yaml \
  --timeout 10m --wait
```

## Step 4: Export Data from Docker Compose

```bash
# Export PostgreSQL (all databases)
docker exec supabase-db pg_dumpall -U supabase_admin > /tmp/pg-dump.sql

# Export Redis RDB (if needed)
docker cp deploy-redis-1:/data/dump.rdb /tmp/redis-dump.rdb
```

## Step 5: Import Data

```bash
# Wait for CNPG cluster to be ready
kubectl wait cluster -n aether aether-pg --for=condition=Ready --timeout=300s

# Port-forward the pooler for import
kubectl port-forward -n aether svc/aether-pg-pooler-rw 5432:5432 &

# Import PostgreSQL dump
PGPASSWORD=<password> psql -h 127.0.0.1 -U postgres -f /tmp/pg-dump.sql

# Kill port-forward
kill %1
```

## Step 6: Configure DNS

Get Kong's external IP:

```bash
kubectl get svc -n aether -l app.kubernetes.io/name=kong -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
```

Point your domain's DNS A record to this IP.

## Step 7: Verify SSL Certificate

```bash
# Check certificate status
kubectl get certificate -n aether

# Check cert-manager logs if issues
kubectl logs -n cert-manager -l app=cert-manager

# Verify HTTPS
curl -v https://your-domain.com/v1/health
```

For Let's Encrypt, start with `ssl.environment: staging` to verify the challenge works. Then switch to `prod`:

```bash
helm upgrade aether helm/aether -f my-values.yaml --set ssl.environment=prod
```

## Step 8: Full Verification

```bash
# Check all pods are running
make status

# Test API health
curl https://your-domain.com/v1/health

# Test LLM proxy
curl https://your-domain.com/v1/models \
  -H "Authorization: Bearer <LITELLM_MASTER_KEY>"

# Test Kong rate limiting
for i in $(seq 1 5); do curl -s -o /dev/null -w "%{http_code}\n" https://your-domain.com/v1/health; done
```

## Rollback

```bash
# Helm rollback to previous release
helm rollback aether -n aether

# Or uninstall completely
make uninstall
```

## Switching SSL from Staging to Production

After verifying staging certificates work:

```bash
helm upgrade aether helm/aether \
  -f helm/aether/values.yaml \
  -f my-values.yaml \
  --set ssl.environment=prod
```

cert-manager will request a new trusted certificate. The old staging cert Secret is replaced automatically.

## Backup Configuration

Enable CNPG S3 backups in production:

```yaml
cnpg:
  backup:
    enabled: true
    s3:
      bucket: aether-pg-backups
      region: us-east-1
      # For S3-compatible storage (MinIO, etc.):
      # endpoint: https://s3.example.com
      # accessKey and secretKey must be in a K8S Secret
```

Manual backup trigger:

```bash
kubectl apply -n aether -f - <<EOF
apiVersion: postgresql.cnpg.io/v1
kind: Backup
metadata:
  name: manual-backup-$(date +%Y%m%d)
spec:
  cluster:
    name: aether-pg
EOF
```

## Troubleshooting

### Certificate not issued

```bash
kubectl describe certificate -n aether
kubectl describe order -n aether
kubectl describe challenge -n aether
```

Common issues:
- DNS not pointing to Kong's LoadBalancer
- Port 80 blocked by firewall (HTTP-01 challenge needs it)
- Rate limited by Let's Encrypt (use staging first)

### Pods not starting

```bash
kubectl describe pod <pod-name> -n aether
kubectl logs <pod-name> -n aether
```

Common issues:
- CNPG cluster not ready yet (check `kubectl get cluster -n aether`)
- Image pull errors (check image names and registry access)
- Resource limits (node too small)

### Database connection failures

```bash
# Check CNPG cluster status
kubectl get cluster -n aether
kubectl describe cluster aether-pg -n aether

# Check pooler
kubectl get pooler -n aether
```

Common issues:
- Pooler not running yet
- Wrong database name in connection string
- User credentials not synced
