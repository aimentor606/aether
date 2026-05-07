# Aether Tech Stack

> Last updated: 2026-05-07

## Runtime & Language

| Layer | Technology | Version |
|-------|-----------|---------|
| Language | TypeScript | ^5.0 ~ ^5.9 |
| API Runtime | Bun | `bun --hot` hot reload |
| Web Runtime | Node.js (Next.js) | — |
| Mobile Runtime | Expo (React Native) | Expo 54 / RN 0.81 |
| Package Manager | pnpm | 8.15.8 (monorepo workspace) |

---

## Backend (apps/api)

Port 8008. Hono v4 monolith on Bun.

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | Hono | ^4.4 | Lightweight, multi-runtime |
| ORM | Drizzle ORM | ^0.44 | Type-safe SQL, no abstraction layer |
| Database | PostgreSQL | — | Via `postgres` driver ^3.4 |
| Auth | Supabase Auth + API Key | — | 3 strategies: apiKeyAuth / supabaseAuth / combinedAuth |
| Validation | Zod | ^3.23 | All POST/PUT bodies |
| Billing | Stripe | ^14 | Webhooks + subscriptions + credits |
| LLM Proxy | LiteLLM (standalone :4000) | — | Redis → OpenAI/Anthropic/Google |
| AI SDK | Vercel AI SDK | ai ^6.0 | @ai-sdk/anthropic, openai, google, xai |
| Observability | Sentry + Pino + Logtail | — | Error tracking, structured logging |
| Container Mgmt | Dockerode | ^4 | Sandbox lifecycle |
| Cron | Croner | ^9 | Scheduled tasks |
| Usage Metering | OpenMeter SDK | 1.0.0-beta | |

### API Structure

```
apps/api/src/
  index.ts              Entry point (~200 lines after split)
  middleware/
    auth.ts             3-strategy auth system
    tenant-config-loader.ts  Per-tenant config with 5-min LRU cache
    global.ts           Cross-cutting middleware
  verticals/
    routes/             finance.ts, insurance.ts, advisor.ts
    services/           Business logic adapters
    schemas/            Zod validation
    middleware/         account-context, pagination
  router/               Model routing, playground
  billing/              Stripe integration
  sandbox-proxy/        WebSocket proxy to sandboxes
```

---

## Sandbox Runtime (core/master)

Docker-based sandbox orchestrator.

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | Hono | ^4.0 | Same as API |
| Agent Runtime | OpenCode SDK | ^1.2 | Code execution in sandboxes |
| Chat Channels | Telegram / Slack / Discord | — | Multi-channel message adapters |
| API Docs | Hono OpenAPI + Scalar | — | Auto-generated API reference |
| Auth | OpenAuth | ^0.4 | |
| Search/Crawl | Firecrawl + Tavily | — | Web scraping and search |
| AI Inference | Replicate | — | |
| Container | Docker Compose | — | Sandbox orchestration |

---

## Frontend (apps/web)

Port 3000. Next.js 15 App Router with Turbopack.

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | Next.js | 15.5 | App Router + Turbopack |
| React | React | ^18 | |
| Styling | Tailwind CSS | v4 | + tailwind-merge, CVA |
| UI Primitives | Radix UI | 23+ components | AlertDialog → VisuallyHidden |
| State | Zustand | ^5 | Client state |
| Server Cache | TanStack Query | ^5 | Server state |
| Forms | React Hook Form + Zod | ^7 / ^3 | |
| Charts | Recharts | ^3 | |
| Data Grid | AG Grid + TanStack Table | ^35 / ^8 | Large dataset tables |
| Rich Editor | TipTap | v3 | 14+ extensions |
| Code Editor | CodeMirror 6 | — | Via @uiw/react-codemirror |
| Terminal | xterm.js | ^5 | Sandbox terminal emulator |
| Spreadsheet | Syncfusion + Univerjs + ExcelJS | — | Multi-engine spreadsheet |
| Document Viewer | PDF.js + docx-preview | — | |
| Markdown | react-markdown + Streamdown | — | Streaming markdown rendering |
| Diagrams | Mermaid | ^11 | |
| Collaboration | Yjs | ^13 | CRDT real-time collab |
| Animation | Framer Motion | ^12 | |
| i18n | next-intl | ^4 | |
| Notifications | Novu | ^3 | |
| Integrations | Pipedream SDK | ^2 | |
| Analytics | PostHog + Vercel Analytics | — | |
| E2E Testing | Playwright | ^1.57 | |
| Unit Testing | Vitest | ^4 | |

---

## Mobile (apps/mobile)

Expo-based cross-platform app.

| Category | Technology | Version | Notes |
|----------|-----------|---------|-------|
| Framework | Expo | 54 | React Native 0.81 |
| Navigation | Expo Router | ^6 | File-based routing |
| React | React | ^19 | **Differs from web (^18)** |
| Styling | NativeWind | ^4 | Tailwind for RN |
| Bottom Sheet | @gorhom/bottom-sheet | ^5 | |
| Animation | Reanimated + Lottie | ^4 / ^7 | |
| Gesture | RN Gesture Handler | ^2 | |
| IAP | RevenueCat | ^9 | react-native-purchases |
| i18n | i18next | ^25 | |

---

## Shared Packages (packages/)

| Package | Responsibility |
|---------|---------------|
| `@aether/db` | Drizzle ORM schemas (31+ tables) + PostgreSQL client + RLS |
| `@aether/sdk` | Supabase auth + API client + React Query hooks + Zustand stores |
| `@aether/ui` | 31 UI primitives + Chat components + A2UI renderer + Editor |
| `@aether/theme` | Design system theme tokens |
| `@aether/vertical-finance` | Finance domain: invoices, expenses, ledger, budgets |
| `@aether/vertical-insurance` | Insurance domain: policies, claims, leads |
| `@aether/vertical-advisor` | Advisor domain: portfolios, risk assessments |
| `@aether/agent-tunnel` | SSH tunnel client for sandbox access |
| `@aether/shared` | Shared utilities |
| `@aether/voice` | Voice integration |

---

## Infrastructure

```
Browser/Mobile/SDK → Nginx (LB/SSL)
  ├── apps/web (Next.js :3000)     — SSR + React Query
  ├── apps/api (Hono/Bun :8008)    — Auth → Tenant Context → Routes → DB
  ├── LiteLLM Proxy (:4000)        — Redis → OpenAI/Anthropic/Google
  └── core/ (Docker sandbox)       — master → OpenCode agents
```

| Component | Technology | Notes |
|-----------|-----------|-------|
| Reverse Proxy | Nginx | LB + SSL termination |
| Cache | Redis | LLM proxy cache |
| Auth Provider | Supabase | JWT + JWKS, local verification |
| Database | PostgreSQL | Drizzle ORM, 31+ tables |
| Container Runtime | Docker | Sandbox isolation |
| CI/CD | — | Not yet configured |
| Monitoring | Sentry + PostHog | Error tracking + product analytics |

---

## Version Inconsistencies

| Issue | Detail | Risk |
|-------|--------|------|
| React version | Web ^18 vs Mobile ^19 | Shared packages must test both |
| Tailwind CSS | Web v4 vs Mobile v3 (NativeWind) | Class API differences |
| Dependency count | Web 200+ dependencies | Maintenance burden, bundle size |
| API monolith growth | Was 1,455 lines, split to 7 modules | Monitor for re-growth |
| RLS activation | Migrations exist but session variable middleware deferred | Multi-tenant data isolation gap |

---

## Development Commands

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
cd apps/api && bun test                                        # All API tests
cd apps/api && bun test src/__tests__/vertical-routes.test.ts   # Single test file
cd apps/web && pnpm test                                       # Vitest unit tests
cd apps/web && pnpm test:e2e                                   # Playwright E2E
cd core/master && bun test                                     # Core runtime tests
```
