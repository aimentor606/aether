# Frontend Architecture — Page & Route Structure

> Last updated: 2026-05-07

## Overview

Aether Web is a Next.js 15 App Router application with 70+ pages organized into 4 route groups, 2 standalone areas, and multiple auth tiers.

**Tech stack:** Next.js 15 (App Router, Turbopack), React 19, Tailwind CSS v4, Framer Motion, Zustand (34 stores), React Query, Radix UI primitives.

---

## Route Architecture

### Root Layout (`apps/web/src/app/layout.tsx`)

Global providers only — no visual chrome:

- `ThemeProvider`, `AuthProvider`, `I18nProvider`, `ReactQueryProvider`, `IntegrationConnectProvider`
- Lazy-loaded analytics: Vercel Analytics, SpeedInsights, GTM, PostHog
- `Toaster` (sonner), `AnnouncementDialog`, `RouteChangeTracker`, `AuthEventTracker`
- Fonts: Roobert (sans) + Roobert Mono

---

## Route Groups

### 1. `(home)` — Marketing/Public Site

**Layout:** `apps/web/src/app/(home)/layout.tsx`
**Chrome:** Fixed `<Navbar>` + `<SimpleFooter>` + global `<NewInstanceModal>`
**Auth:** All pages are public

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/about` | Company info |
| `/app` | App download page |
| `/brand` | Brand guidelines |
| `/careers` | Job listings |
| `/enterprise` | Enterprise offering |
| `/exploration` | Product showcase |
| `/factory` | Factory landing page |
| `/pricing` | Pricing plans |
| `/status` | System status |
| `/support` | Support contact |
| `/tutorials` | Tutorials |
| `/partnerships` | Partnership info |
| `/berlin` | Berlin landing variant |
| `/milano` | Milano landing variant |
| `/variant-2` | Landing page A/B variant |

### 2. `(dashboard)` — Main Authenticated App

**Layout:** `apps/web/src/app/(dashboard)/layout.tsx` → `DashboardLayoutContent`
**Chrome:** Left sidebar (`SidebarLeft`) + Right sidebar (`SidebarRight`) + Tab bar (`TabBar`) + `CommandPalette` + `StatusOverlay` + `FilePreviewDialog`
**Auth:** Authenticated + active instance required

During onboarding, the chrome hides and morphs in after setup completes.

| Route | Purpose |
|-------|---------|
| `/dashboard` | Main dashboard |
| `/workspace` | Workspace/project view |
| `/projects` | Projects list (redirect) |
| `/projects/[id]` | Project detail |
| `/sessions/[sessionId]` | Session chat view |
| `/legacy/[threadId]` | Legacy thread viewer |
| `/browser` | Built-in browser tab |
| `/desktop` | Desktop/remote viewer |
| `/files` | File explorer root |
| `/files/[...path]` | File explorer (deep path) |
| `/terminal/[id]` | Terminal session |
| `/channels` | Channel management |
| `/connectors` | Integration connectors |
| `/connectors/connect-callback` | OAuth callback |
| `/commands` | Commands (redirect) |
| `/tools` | Tools (redirect) |
| `/configuration` | OpenCode config (redirect) |
| `/memory` | Memory (redirect) |
| `/models` | Model playground |
| `/marketplace` | Agent marketplace |
| `/skills` | Skills marketplace |
| `/scheduled-tasks` | Scheduled tasks manager |
| `/deployments` | Deployments |
| `/service-manager` | Service manager |
| `/services/running` | Running services |
| `/changelog` | Changelog viewer |
| `/finance` | Finance/billing overview |
| `/usage` | Usage statistics |
| `/credits-explained` | Credits explanation |
| `/tunnel` | Tunnel overview |
| `/tunnel/[tunnelId]` | Tunnel detail |
| `/p/[port]` | Port proxy viewer |
| `/settings/api-keys` | API key management |
| `/settings/credentials` | Secrets manager |
| `/settings/providers` | LLM provider settings |
| `/[...catchAll]` | Catch-all 404 |

### 3. `(ops)` — Admin/Ops Portal

**Layout:** `apps/web/src/app/(ops)/layout.tsx`
**Chrome:** `OperationsPortalLayout` — `<OpsSidebar>` + header with `<SidebarTrigger>`
**Auth:** Admin-only (middleware checks `ADMIN_ROLE_COOKIE`, 5-min TTL, verified via backend `/user-roles`)

| Route | Purpose |
|-------|---------|
| `/admin/access-requests` | Access request management |
| `/admin/analytics` | Platform analytics |
| `/admin/feature-flags` | Feature flag toggles |
| `/admin/feedback` | User feedback viewer |
| `/admin/litellm` | LiteLLM admin panel |
| `/admin/notifications` | Admin notifications |
| `/admin/sandbox-pool` | Sandbox pool management |
| `/admin/sandboxes` | Sandbox instance manager |
| `/admin/stateless` | Stateless instance admin |
| `/admin/stress-test` | Stress testing tools |
| `/admin/utils` | Admin utility tools |

### 4. `/docs` — Documentation

**Layout:** `apps/web/src/app/docs/layout.tsx`
**Chrome:** Fumadocs `DocsLayout` with page tree sidebar + top navbar (logo, Home, GitHub)
**Auth:** Public

| Route | Purpose |
|-------|---------|
| `/docs/[[...slug]]` | Documentation (catch-all MDX) |

### 5. `/help` — Help Center

**Layout:** `apps/web/src/app/help/layout.tsx`
**Chrome:** `<HelpSidebar>` + scroll area + `Cmd+K` search modal
**Auth:** Public

| Route | Purpose |
|-------|---------|
| `/help` | Help center landing |
| `/help/credits` | Credits explanation |

---

## Standalone Routes (No Route Group)

These sit directly under `/src/app/` with bare chrome (root layout only — providers, no navbar/sidebar).

| Route | Purpose | Auth |
|-------|---------|------|
| `/auth` | Login/signup | Public |
| `/auth/password` | Password auth flow | Public |
| `/auth/reset-password` | Password reset | Public |
| `/auth/phone-verification` | Phone verification | Public |
| `/auth/github-popup` | GitHub OAuth popup | Public |
| `/checkout` | Checkout/payment | Public |
| `/onboarding` | First-time setup wizard | Authenticated |
| `/setup` | Initial setup | Authenticated |
| `/instances` | Instance list/selector | Authenticated |
| `/instances/[id]` | Instance detail | Authenticated |
| `/instances/[id]/backups` | Instance backups | Authenticated |
| `/instances/[id]/onboarding` | Instance onboarding | Authenticated |
| `/subscription` | Subscription management | Authenticated |
| `/activate-trial` | Trial activation | Authenticated |
| `/share/[shareId]` | Shared conversation replay | Public |
| `/templates/[shareId]` | Template install | Public |
| `/oauth/authorize` | OAuth authorization | Authenticated |
| `/tunnel/authorize/[code]` | Tunnel auth approval | Authenticated |
| `/legal` | Legal/terms | Public |
| `/countryerror` | Country restriction error | Public |

---

## Navigation Flow

```
New user:
  / (landing) → /auth (login) → /onboarding (setup) → /instances (select) → /instances/:id/dashboard

Returning user:
  / → 302 redirect → /instances → select instance → /instances/:id/dashboard

Admin:
  /admin/* (separate Ops sidebar, admin cookie 5-min TTL cache)
```

### Instance Route Rewriting

Middleware rewrites `/instances/:id/*` to bare `(dashboard)/*` routes. Instance context is preserved via `ACTIVE_INSTANCE_COOKIE`. Users see instance-scoped URLs; code handles bare routes.

Example: `/instances/abc123/files` → middleware rewrites to `/files` with instance `abc123` in cookie.

---

## Authentication Tiers

| Tier | Routes | Middleware Behavior |
|------|--------|--------------------|
| **Public** | `/`, `/auth/*`, `/legal`, `/share/*`, `/templates/*`, `/checkout`, `/docs`, `/help`, all `(home)` pages | No auth check |
| **Billing** | `/activate-trial`, `/subscription`, `/instances` | Requires auth (user object), no subscription check |
| **Protected** | All `(dashboard)` routes, `/onboarding`, `/setup` | Requires auth. Bare routes redirect to instance-scoped versions |
| **Admin** | All `(ops)/admin/*` | Requires auth + admin role |

---

## UI Chrome Summary

| Chrome Type | Route Groups | Layout Components |
|-------------|-------------|-------------------|
| **Navbar + Footer** | `(home)` | `Navbar` (fixed) + `SimpleFooter` |
| **Sidebar + TabBar + RightSidebar** | `(dashboard)` | `SidebarLeft` + `TabBar` + `SidebarRight` + `CommandPalette` |
| **Ops Sidebar** | `(ops)` | `OpsSidebar` + header with `SidebarTrigger` |
| **Fumadocs Sidebar** | `/docs` | Fumadocs `DocsLayout` with page tree |
| **Help Sidebar** | `/help` | `HelpSidebar` + search modal |
| **Bare** | `/auth`, `/instances`, `/checkout`, etc. | Root layout only (providers) |

---

## Key Design Patterns

### Tab System (Pre-mounted)

Dashboard pages are pre-mounted and toggled via CSS `display` show/hide, not unmounted/remounted. This preserves session state (terminal buffers, chat history, file trees) across tab switches.

### Data Architecture (3 layers)

- **SSE** (Server-Sent Events) for real-time server push
- **Zustand stores** (34 stores) for client state
- **React Query** for server state with caching

### Multi-Instance Routing

Cookie-based instance selection (`ACTIVE_INSTANCE_COOKIE`) with middleware URL rewriting. Each instance gets its own URL namespace while sharing the same dashboard code.

### Error Boundaries

| Route Group | Error Boundary |
|-------------|---------------|
| Global | `global-error.tsx` — full-page crash screen |
| `(home)` | `error.tsx` — home-themed error UI |
| `(dashboard)` | `error.tsx` — dashboard-themed error UI with Sentry |
| `(ops)` | `error.tsx` — admin error with Sentry |
| `auth` | `error.tsx` — auth error with back-to-login |
| `checkout` | `error.tsx` — checkout error (revenue-safe) |
| `instances` | `error.tsx` — instance error with Sentry |
| `onboarding` | `error.tsx` — setup error with Sentry |

### Accessibility

- Global `prefers-reduced-motion` CSS guard disables all animations for users who prefer reduced motion
- Semantic color tokens (`text-muted-foreground`) with WCAG AA compliant opacity levels (>=70%)
- `useReducedMotion` hook available at `apps/web/src/hooks/use-reduced-motion.ts`
