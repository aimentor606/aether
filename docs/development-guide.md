# Aether Development Guide

Complete guide for developing, testing, building, and deploying Aether.

## Prerequisites

- **Node.js** 22+ (LTS)
- **pnpm** 8.15+ (pinned via `packageManager` in package.json, use `corepack enable pnpm`)
- **Bun** 1.2+ (API runtime and test runner)
- **Docker** (sandbox runtime, local Supabase)
- **Supabase CLI** (local database)

## Quick Start

```bash
# Install dependencies
pnpm install

# Start local Supabase + frontend + API (one command)
pnpm dev
```

This runs `scripts/dev-local.sh` which:
1. Starts local Supabase (Docker, Postgres on `127.0.0.1:54322`)
2. Starts Next.js frontend on `:3000`
3. Starts Hono API on `:8008` (with `AETHER_SKIP_ENSURE_SCHEMA=1`)

## Development Commands

### By Service

```bash
# Everything (Supabase + frontend + API)
pnpm dev

# API only (bun --hot reload on :8008)
pnpm dev:api

# Frontend only (next dev --turbopack on :3000)
pnpm dev:web

# Mobile app (Expo)
pnpm dev:mobile

# Sandbox runtime (Docker Compose)
pnpm dev:core
```

### Against Production Backend

```bash
# Connect local frontend to production API
pnpm dev:prod
```

### Dependency Management

```bash
# Install all dependencies
pnpm install

# Add dependency to specific package
pnpm --filter aether-api add <package>
pnpm --filter @aether/db add <package>

# Add workspace dependency (e.g., use @aether/db in a new package)
# In package.json: "@aether/db": "workspace:*"

# Clean install (CI-safe, fails if lockfile mismatch)
pnpm install --frozen-lockfile
```

pnpm uses content-addressable storage. Root `node_modules/` holds actual packages, sub-packages have symlink-only `node_modules/`. No disk duplication.

## Testing

### API Tests (bun test)

```bash
# All API tests
cd apps/api && bun test

# Specific test file
cd apps/api && bun test src/__tests__/vertical-routes.test.ts

# Run with the full test script (ordered billing → e2e → unit)
cd apps/api && pnpm test
```

Test structure in `apps/api/src/__tests__/`:

```
__tests__/
  billing/             Billing unit tests
  e2e-*.test.ts        Integration tests (router, billing routes, platform)
  unit-*.test.ts       Unit tests (spend reconciler, preview auth, etc.)
  vertical-routes.test.ts    Vertical domain route tests
```

### Core Tests

```bash
cd core/master && bun test
```

### Frontend Tests

```bash
cd apps/web
pnpm test:workspace-search     # Workspace search unit test
pnpm test:e2e                  # Playwright E2E tests
pnpm test:e2e:ui               # Playwright with UI
```

### Type Checking

```bash
# Type check all packages (used in CI quality gate)
pnpm run typecheck

# Individual packages
cd apps/api && pnpm typecheck
cd packages/db && pnpm typecheck
cd packages/sdk && pnpm typecheck
```

### Linting

```bash
# Frontend lint
cd apps/web && pnpm lint

# Vertical packages
pnpm lint:verticals
```

## Database

### Schema and Migrations

Schema files in `packages/db/src/schema/`:

| File | Contents |
|------|----------|
| `aether.ts` | Main schema (31+ tables, accounts, users, sandboxes) |
| `finance.ts` | Finance vertical tables |
| `insurance.ts` | Insurance vertical tables |
| `advisor.ts` | Advisor vertical tables |
| `shared-vertical.ts` | Shared vertical base types |
| `public.ts` | Public schema types |

Migrations live in `packages/db/drizzle/`.

### Database Commands

```bash
cd packages/db

# Generate migration from schema changes
pnpm db:generate

# Run migrations against database
pnpm db:migrate

# Push schema directly (dev only, no migration file)
pnpm db:push

# Mark existing database as baseline (skip already-applied migrations)
pnpm db:migrate:mark-baseline

# Visual schema browser
pnpm db:studio
```

### Local Supabase (Self-Hosted)

`pnpm dev` starts the self-hosted Supabase stack automatically. Manual control:

```bash
cd scripts/supabase
docker compose --env-file .env up -d     # Start all 13 services
docker compose --env-file .env down      # Stop
docker compose --env-file .env ps        # Check status
```

Ports: Postgres `127.0.0.1:5434` (direct) / `5433` (pooler), Kong API `:8000`, Studio `:3000`, Auth `:9999`

### Remote Database (Supabase Cloud)

Apply migrations via Supabase SQL Editor:
1. Open Supabase Dashboard > SQL Editor
2. Copy SQL from `packages/db/drizzle/<migration>.sql`
3. Execute

## Building

### Build All Packages

```bash
pnpm build
```

### Build Vertical Packages

```bash
pnpm build:verticals
```

### Docker Build

Built from repo root. CI builds multi-arch (amd64 + arm64) in parallel.

```bash
# API image (from repo root)
docker build --file apps/api/Dockerfile --build-arg SERVICE=apps/api \
  -t aether/aether-api:latest .

# Frontend image (pre-build web first, then Docker packages output)
cd apps/web && NEXT_OUTPUT=standalone pnpm run build && cd ../..
docker build -f apps/web/Dockerfile -t aether/aether-frontend:latest .
```

**API Dockerfile** (`apps/api/Dockerfile`):
- Multi-stage: `node:22-slim` installs deps with pnpm, `oven/bun` runs app
- Uses `--shamefully-hoist` in deps stage for Docker COPY compatibility
- Copies workspace packages (shared, db, agent-tunnel) into image

**Frontend Dockerfile** (`apps/web/Dockerfile`):
- Requires `next build` with standalone output on host first
- Copies `.next/standalone`, static assets, and public dir
- Runs as non-root `nextjs` user on port 3000

### Build-time Environment Variables (Frontend)

These are baked into the Next.js build:

```
NEXT_PUBLIC_ENV_MODE            "local" or "cloud"
NEXT_PUBLIC_BILLING_ENABLED     "true" for cloud, "false" for self-hosted
NEXT_PUBLIC_BACKEND_URL         API URL
NEXT_PUBLIC_URL                 Frontend URL
NEXT_PUBLIC_SUPABASE_URL        Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   Supabase anon key
```

## CI/CD

### Dev Deploy (`.github/workflows/deploy-dev.yml`)

Triggered on push to `main` (path-filtered) or manual dispatch.

```
push to main
  → quality-gate (typecheck + bun test)
  → gate (check AUTO_DEPLOY_DEV variable)
  → detect-changes (API? Frontend? Computer?)
  → build-*-amd64 + build-*-arm64 (parallel, only changed images)
  → merge-* (create multi-arch manifests)
  → deploy-api (SSH to dev VPS, zero-downtime deploy)
  → trigger-dev-snapshot (async)
```

### Production Release (`.github/workflows/release.yml`)

Manual trigger only. Promotes dev images to production (no rebuild).

```
workflow_dispatch (version, title, description)
  → quality-gate (typecheck + bun test)
  → retag-images (dev-latest → versioned + latest tags)
  → deploy-prod (SSH to prod VPS)  ─┐
  → update-production-branch (fast-forward for Vercel)  ├── parallel
                                       ─┘
  → create-release (Git tag + GitHub Release)
  → build-prod-snapshot (async)
```

### Path Filters (build only what changed)

| Service | Paths |
|---------|-------|
| API | `apps/api/**`, `packages/**`, `pnpm-lock.yaml` |
| Frontend | `apps/web/**`, `packages/shared/**`, `pnpm-lock.yaml` |
| Computer | `core/**` |

## Deployment (VPS)

All deploy scripts in `scripts/deploy/ops/`.

### Initial Setup

```bash
cd scripts/deploy

# 1. Create data directories and set permissions
bash ops/setup.sh

# 2. Create Docker network
bash ops/init-network.sh

# 3. Copy and edit environment
cp ops/.env.example ops/.env
# Edit ops/.env — change ALL CHANGE_ME values!

# 4. Configure Kong routes
bash ops/kong-bootstrap.sh
bash ops/sync-kong.sh
```

### Start/Stop Services

```bash
# Start all services (validates secrets, checks SSL certs)
bash ops/start.sh

# Stop all services
bash ops/stop.sh

# Restart all services
bash ops/restart.sh

# View service status
bash ops/status.sh
```

### Service Selection

`start.sh` reads `LLM_PROXY` from `ops/.env`:
- `LLM_PROXY=newapi` (default): Runs NewAPI as LLM proxy
- `LLM_PROXY=litellm`: Runs LiteLLM as LLM proxy

### Health Verification

```bash
# Verify all services are healthy (containers, CORS, auth, frontend)
bash ops/verify.sh
```

Checks: container health, CORS preflight, API key auth, frontend response, Kong admin.

### Zero-Downtime Deploy

Used by CI/CD to deploy new API versions without downtime:

```bash
PREBUILT_IMAGE="aether/aether-api:<version>" bash scripts/deploy-zero-downtime.sh
```

### Useful Operations

```bash
# Pull latest images
bash ops/pull-images.sh

# View logs (all services)
bash ops/logs.sh

# Backup database
bash ops/backup.sh

# Full reset (WARNING: deletes data)
bash ops/reset.sh
```

## Project Structure

```
apps/
  api/              Hono API on Bun (port 8008)
    src/
      index.ts        API entry point (CORS, auth, routes, WebSocket)
      middleware/      auth.ts, tenant-config-loader.ts, tenant-rate-limit.ts
      verticals/      routes/, services/, schemas/, middleware/
      billing/        credits, subscriptions, payments, webhooks
      platform/       account, api-keys, sandbox-*
      __tests__/      Unit and integration tests
  web/              Next.js frontend (port 3000)
    src/app/          App Router pages
packages/
  db/               Drizzle ORM schemas + migrations
    src/schema/       aether.ts, finance.ts, insurance.ts, advisor.ts
    drizzle/          SQL migration files
  sdk/              Client (React hooks) + server SDKs
  ui/               Shared UI primitives (31 components)
  shared/           Shared utilities
  finance/          Vertical: invoices, expenses, ledger, budgets
  insurance/        Vertical: policies, claims, leads, compliance
  advisor/          Vertical: portfolios, risk assessments, financial plans
  agent-tunnel/     SSH tunnel client for sandbox access
  theme/            Theme system
core/
  master/           Sandbox orchestrator (OpenCode agents)
  docker/           Docker compose configs
scripts/
  dev-local.sh      Local dev (Supabase + frontend + API)
  dev-prod.sh       Dev against production API
  deploy/
    core/           Docker Compose files (kong, postgres, redis, litellm, newapi)
    ops/            Operational scripts (start, stop, verify, backup, etc.)
tests/              Playwright E2E test suite
supabase/           Local Supabase config + migrations
```

## Common Workflows

### Add a New API Route

1. Create route file in `apps/api/src/<domain>/routes/<name>.ts`
2. Add `combinedAuth` middleware at mount point
3. Add Zod schema for request validation
4. Add test in `apps/api/src/__tests__/`
5. Mount in `apps/api/src/index.ts`

### Add a New Database Table

1. Edit schema in `packages/db/src/schema/` (pick the right file)
2. Add `accountId` column for multi-tenant isolation
3. Generate migration: `cd packages/db && pnpm db:generate`
4. Apply locally: `cd packages/db && pnpm db:push` (or restart Supabase)
5. Apply to remote: SQL Editor in Supabase Dashboard

### Add a New Vertical Domain

1. Create package in `packages/<domain>/`
2. Add schema in `packages/db/src/schema/<domain>.ts`
3. Export from `packages/db/src/schema/index.ts`
4. Create routes in `apps/api/src/verticals/routes/<domain>.ts`
5. Create service adapter in `apps/api/src/verticals/services/`
6. Create Zod schemas in `apps/api/src/verticals/schemas/`
7. Mount in `apps/api/src/verticals/index.ts` with `combinedAuth`

### Add a Workspace Dependency

```bash
# Add package B as dependency of package A
cd packages/A
# In package.json, add: "@aether/B": "workspace:*"
pnpm install
```

## Environment Variables

### Local Development

`pnpm dev` starts local Supabase. API connects automatically. No `.env` needed for basic dev.

Key env vars used by API (set by dev-local.sh or Supabase):

| Variable | Purpose | Default (local) |
|----------|---------|-----------------|
| `SUPABASE_URL` | Supabase endpoint | `http://127.0.0.1:8000` |
| `SUPABASE_ANON_KEY` | Supabase anon key | From `scripts/supabase/.env` |
| `DATABASE_URL` | Postgres connection | `postgresql://postgres:...@127.0.0.1:5434/postgres` |

### VPS Deployment

All variables in `scripts/deploy/ops/.env`. See `ops/.env.example` for full list.

Critical secrets (must change from `CHANGE_ME`):
`DB_ROOT_PASSWORD`, `REDIS_PASSWORD`, `KONG_PG_PASSWORD`, `SESSION_SECRET`, `NEWAPI_DB_PASSWORD`, `LITELLM_DB_PASSWORD`, `LITELLM_MASTER_KEY`, `LITELLM_SALT_KEY`, `DEFAULT_API_KEY`

`start.sh` validates these at startup and refuses to start if any are still placeholder values.
