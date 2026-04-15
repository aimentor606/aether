# Draft: Phase 1 SDK Design

## Requirements (confirmed)
- A2UI: Add as new layer on top of existing static tool registries (user confirmed)
- No code writing until design approved: user said "先不要写代码，继续讨论"
- packages/sdk/ and packages/ui/ scaffolding already exists from Phase 0

## Technical Decisions
- **A2UI Strategy**: A2UI as new layer — keep existing static registries for known tools, add A2UI for dynamic/agent-driven UI. Lowest risk, fastest to ship.
- **Rationale**: 35+ production-tested tool views should not be rewritten. A2UI solves a different problem (agent-declared dynamic UI). Both can coexist with priority: static registry → A2UI → GenericToolView.

## Research Findings
- **Two tool registries exist**:
  1. Thread: `thread/tool-views/wrapper/ToolViewRegistry.tsx` — class-based, fuzzy matching, 35+ Oc* views
  2. Session: `session/tool-renderers.tsx` — Map<string, Component>, self-registering
- **Zero A2UI usage** in the web app currently
- **packages/sdk/src/a2ui/** has scaffolding only (parser, validator, catalog) — not wired

## Test Strategy Decision
- **Infrastructure exists**: NO (for packages/sdk/ and packages/ui/)
- **Automated tests**: YES (bun test)
- **Framework**: bun test — consistent with apps/api/ already using it
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

## Open Questions
- ~~Q2: SDK layer design — hooks pattern or direct function exports?~~ → **React Hooks** (user confirmed)
- ~~Q3: Phase 1 scope — which modules migrate first?~~ → **Auth + API Client only** (user confirmed). SSE, LLM, A2UI deferred to Phase 2+.
- ~~Q4: LiteLLM integration depth~~ → Deferred (not in Phase 1 scope)
- ~~Q5: State management migration strategy~~ → **zustand + react-query** (user confirmed). SDK auth hooks use zustand internally, API hooks use @tanstack/react-query for caching/revalidation.
- ~~Q6: Test strategy~~ → **bun test** (user confirmed). Consistent with existing apps/api/ usage.

## Scope Boundaries
- INCLUDE: SDK auth module, API client module, provider/wiring, bun test setup, parallel build in packages/sdk/
- EXCLUDE: SSE/realtime, A2UI, LLM module, UI component migration (Phase 2+), mobile, LiteLLM UI rewrite
- Migration: Approach A — parallel build + swap (build SDK alongside existing code, swap imports in one PR)
