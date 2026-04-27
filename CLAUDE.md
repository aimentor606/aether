# CLAUDE.md - Aether Project Guide

## Project Overview

Aether is an autonomous company operating system. AI agents run in isolated Linux sandboxes, executing code, managing infrastructure, and operating integrations 24/7. The agent runtime is OpenCode. Revenue model: SaaS with credit-based billing, targeting CTOs at startups who need autonomous agents with vertical domain specialization (finance, insurance, advisor) and enterprise multi-tenancy.

## Architecture

```
Browser/Mobile/SDK → Nginx (LB/SSL)
  ├── apps/web (Next.js :3000)    — SSR + React Query
  ├── apps/api (Hono/Bun :8008)   — Auth → Tenant Context → Routes → DB
  ├── LiteLLM Proxy (:4000)       — Redis → OpenAI/Anthropic/Google
  └── core/ (Docker sandbox)      —master → OpenCode agents
```

### Monorepo Structure

```
apps/
  api/          Hono API on Bun runtime (port 8008)
  web/          Next.js frontend (port 3000)
  mobile/       Expo React Native app
  frontend/     Legacy frontend (deprecated)
packages/
  db/           Drizzle ORM schemas + migrations (PostgreSQL)
  sdk/          Client (React) + server SDKs
  ui/           Shared UI primitives (31), chat, A2UI renderer
  finance/      Vertical domain: invoices, expenses, ledger, budgets
  insurance/    Vertical domain: policies, claims, leads, compliance
  advisor/      Vertical domain: portfolios, risk assessments, financial plans
  shared/       Shared utilities
  theme/        Theme system
  voice/        Voice integration
  agent-tunnel/ SSH tunnel client for sandbox access
core/
  master/          Sandbox orchestrator (Docker-based)
  docker/          Docker compose configs
scripts/
  deploy/          Production deployment (core/ compose files + ops/ scripts)
```

## Dev Commands

```bash
pnpm dev              # Start local Supabase + frontend + API
pnpm dev:api          # API only (bun --hot on :8008)
pnpm dev:web          # Web only (next dev --turbopack :3000)
pnpm dev:core         # Sandbox runtime (Docker Compose)
pnpm build            # Build all packages
pnpm run typecheck    # Type check all packages
```

### Testing

```bash
cd apps/api && bun test                                    # All API tests
cd apps/api && bun test src/__tests__/vertical-routes.test.ts  # Single test file
cd core/master && bun test                                 # Core runtime tests
```

Full development guide: [`docs/development-guide.md`](docs/development-guide.md)

## Key Conventions

### API (Hono/Bun)

- **Framework**: Hono v4 on Bun runtime
- **Auth**: 3-strategy system in `apps/api/src/middleware/auth.ts`:
  - `apiKeyAuth`: validates `aether_*` tokens against DB
  - `supabaseAuth`: local JWT verification with JWKS fallback
  - `combinedAuth`: accepts either token type
- **Auth is per-route-group**, not global. Every new route group MUST add `combinedAuth` middleware manually at mount point in `index.ts`.
- **Response format**: `{ success: boolean, data?: T, error?: string, meta?: { limit, offset } }`
- **Validation**: Zod schemas for all POST/PUT bodies
- **Pagination**: Use `pagination(c)` from `apps/api/src/verticals/middleware/account-context.ts` (default limit=50, max=200)
- **Account context**: Use `getAccountId(c)` from same module. Extracts from auth middleware's context, falls back to userId resolution.
- **Error types**: Use domain-specific errors from `apps/api/src/errors.ts` (extend `HTTPException` for automatic global handler catching)

### Vertical Routes

All vertical routes live under `apps/api/src/verticals/`:
```
routes/         finance.ts, insurance.ts, advisor.ts
services/       Business logic layer (adapters to @aether/vertical-* packages)
schemas/        Zod validation schemas
middleware/     account-context.ts (getAccountId, formatZodError, pagination)
index.ts        Mounts all 3 vertical sub-apps
```

Mounted at `/v1/verticals/*` in `apps/api/src/index.ts` with `combinedAuth` guard.

### Database (Drizzle ORM)

- Schema files in `packages/db/src/schema/`: `aether.ts` (main, 37K), `finance.ts`, `insurance.ts`, `advisor.ts`, `shared-vertical.ts`, `public.ts`
- pgSchema namespace: `aether` (was `aether`, not renamed in DB to preserve drizzle migration history)
- Migrations in `packages/db/drizzle/`
- All vertical tables have `accountId` column for multi-tenant isolation
- RLS policies exist in migration `0002_enable_rls_vertical_tables.sql` but not activated (deferred until session variable middleware is built)

### Frontend (Next.js)

- App Router with `(dashboard)` route group
- Admin pages under `apps/web/src/app/(dashboard)/admin/`
- Finance dashboard at `apps/web/src/app/(dashboard)/finance/`
- UI primitives in `packages/ui/src/primitives/` (31 components)
- Chat components in `packages/ui/src/chat/`

## Important Files

| File | Purpose |
|------|---------|
| `apps/api/src/index.ts` | API monolith (1,455 lines). CORS, auth, middleware, sub-app mounts, WebSocket proxy, server startup. |
| `apps/api/src/middleware/auth.ts` | 3-strategy auth system (API key, Supabase JWT, combined) |
| `apps/api/src/middleware/tenant-config-loader.ts` | Loads per-tenant config with 5-min LRU cache |
| `apps/api/src/shared/crypto.ts` | Token validation, key generation |
| `apps/api/src/errors.ts` | Custom error hierarchy (BillingError, TenantIsolationError, etc.) |
| `packages/db/src/schema/aether.ts` | Main DB schema (911 lines, 31+ tables) |
| `apps/api/src/verticals/index.ts` | Vertical sub-app mount point |
| `scripts/rebrand.sh` | Codemod for @aether → @aether rebrand (14 phases) |
| `scripts/rebrand.config.json` | Rebrand configuration |

## Known Issues

- `apps/api/src/index.ts` was split into 7 modules (routes/health, routes/accounts, routes/user-roles, startup/banner, startup/services, startup/shutdown, server.ts). Now ~200 lines.
- Web dependencies deduplicated (18 packages removed). TypeScript errors fixed (3,900 → 0).
- RLS activated: session variable `aether.current_account_id` set per-request via `withTenantContext` (`packages/db/src/rls.ts`). Middleware wired at `/v1/verticals/*`. Migrations 0002, 0005, 0006.

## Rebrand Status

Rebrand from aether/Kortix to Aether is complete in code. Key changes:
- All `@aether/*` package references → `@aether/*`
- All `aether_*` env vars → `AETHER_*`
- CORS origins updated to aether.dev/aether.cloud
- API routes `/v1/aether/*` → `/v1/aether/*`
- DB pgSchema namespace kept as `aether` (was `aether` in drizzle history)
- Internal sandbox paths (`/aether/*`) kept as-is (sandbox code not rebranded)

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
