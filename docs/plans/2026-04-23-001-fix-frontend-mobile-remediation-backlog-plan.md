---
title: fix: Frontend & Mobile Remediation Backlog
type: fix
status: active
date: 2026-04-23
deepened: 2026-04-23
---

# fix: Frontend & Mobile Remediation Backlog

## Overview

Stabilize active frontend surfaces (`apps/web`, `apps/mobile`) by removing silent-failure behavior, resolving current type/module breakages, reducing deprecated/migration drift, and enforcing recurrence-prevention quality gates. Sequencing is reliability-first (P0), then debt cleanup (P1), then governance hardening (P1/P2).

## Problem Frame

Current analysis shows strong product surface area in web/mobile but high-risk quality gaps:
- Silent error swallowing in critical user flows
- Existing TypeScript/module resolution breakages in active web/mobile routes
- Incomplete shared-UI migration and lingering deprecated code paths
- Inconsistent quality gates for frontend/mobile paths

Without remediation, user-visible failures can remain hidden, regression diagnosis stays expensive, and migration debt compounds.

## Requirements Trace

### Planning Output
- R1. Produce a prioritized, executable remediation backlog for frontend/mobile reliability and quality.

### Remediation Outcomes
- R2. Address high-impact runtime reliability issues before lower-risk cleanup.
- R3. Remove currently known diagnostic blockers across active frontend surfaces (`apps/web`, `apps/mobile`) with an explicit baseline/waiver list if any non-targeted diagnostics remain.

### Quality Governance
- R4. Define concrete verification scenarios and enforceable recurrence-prevention gates.

## Scope Boundaries

- No net-new product feature expansion beyond remediation of identified issues.
- No backend domain redesign; backend touched only when required for existing frontend contract alignment.
- No holistic UX redesign; this is a reliability/quality hardening pass.

### Deferred to Separate Tasks

- Large chat/session UX redesigns beyond error-path hardening.
- Full historical cleanup in non-active legacy code not import-reachable from `apps/web` or `apps/mobile`.

**Enforcement rule:** Changes in this plan must be import-reachable from `apps/web` or `apps/mobile`; otherwise record as a **tracked deferral** in the owning unit.

## Context & Research

### Relevant Code and Patterns

- Web surfaces: `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/features/`
- Mobile surfaces: `apps/mobile/app/`, `apps/mobile/components/`, `apps/mobile/lib/`
- Shared UI migration area: `packages/ui/src/primitives/`
- Existing web test anchor: `apps/web/src/features/files/search/workspace-search-core.test.mts`

### Institutional Learnings

- Existing project guidance flags frontend complexity and quality debt concentration.
- Reliability remediations should be staged and measurable.

### External References

- Not required for this plan; backlog is grounded in direct local codebase evidence.

## Key Technical Decisions

- **Reliability first (P0):** Silent failures in core interaction paths are highest risk.
- **Diagnostics before broad refactor:** Type/module health is prerequisite for safe cleanup.
- **Unified error contract:** Remediated paths must provide observability + deterministic UX recovery states.
- **Recurrence gates:** Lint/CI must block both empty catches and silent fallback catches.

## Open Questions

### Resolved During Planning

- **Should `apps/frontend` be part of remediation?** No; it is effectively deprecated/stubbed.
- **Should remediation include new product behaviors?** No; parity/remediation only.

### Deferred to Implementation

- **Telemetry sink standardization details** (Sentry/PostHog/logtail routing granularity) remain implementation-specific, but owner is frontend platform maintainers and this decision must be finalized before Unit 1 verification sign-off.
- **Final deprecation removal order** should be decided after import-reachability checks in active surfaces.

## UX Error-State Contract (Applies to Units 1 and 4)

All remediated flows must implement this state matrix:

| State | Trigger | User-visible behavior | Primary action |
|---|---|---|---|
| loading | async operation started | existing loading UI; do not freeze unrelated controls | cancel/close if supported |
| success | operation completed | primary content rendered | continue |
| empty | valid no-data response | explicit empty-state copy | refresh/retry |
| partial | one dependency fails but flow remains usable | partial-content notice; usable regions preserved | retry failed segment |
| error | operation cannot continue | deterministic message with recovery path | retry / navigate back |

Message hierarchy:
- inline error for local component-bound failures
- toast for non-blocking transient failures
- blocking dialog only when safe progression is impossible

Accessibility gates:
- focus returns to actionable control after failure
- async failures are announced via accessible status region
- mobile actions remain reachable after fallback state activation

## High-Level Technical Design

> *This table communicates implementation order and intent. It is directional guidance, not implementation specification.*

| Priority | Theme | Intended Outcome |
|---|---|---|
| P0 | Error-path hardening | Failures are observable + recoverable, not silent |
| P0 | Type/module correctness | Baseline compile health for active web/mobile surfaces |
| P1 | UI migration + deprecation cleanup | Reduced divergence and lower maintenance burden |
| P1/P2 | Quality gate enforcement | Regression anti-patterns blocked in CI |

## Implementation Units

- [ ] **Unit 0 (P0): Make mobile + UI-package test verification executable**

**Goal:** Ensure Unit 2-4 verification is runnable in repository tooling.

**Requirements:** R1, R4

**Dependencies:** None

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `packages/ui/package.json`
- Modify: `apps/mobile/` (test runner config file, if missing)
- Modify: `packages/ui/` (test runner config file, if missing)

**Approach:**
- Define test command(s) and runner config for mobile and shared UI package.
- If runtime tests cannot be enabled immediately, define temporary verified substitute (type/lint assertions) and capture runtime-test follow-up as tracked deferral.

**Patterns to follow:**
- Existing script conventions in root and app manifests.

**Test scenarios:**
- Happy path: mobile and UI-package test commands execute in CI-compatible mode.
- Error path: intentional failing sample test produces non-zero exit and clear output.

**Verification:**
- Mobile and UI-package verification commands exist and run locally/CI.

- [ ] **Unit 1 (P0): Harden critical error paths and eliminate silent catches**

**Goal:** Replace silent failure handling with explicit, observable, user-recoverable behavior in critical flows.

**Requirements:** R1, R2

**Dependencies:** Unit 0

**Files:**
- Modify: `apps/web/src/components/session/session-chat.tsx`
- Modify: `apps/web/src/features/files/api/opencode-files.ts`
- Modify: `apps/web/src/stores/server-store.ts`
- Modify: `apps/web/src/features/files/search/workspace-search-service.ts`
- Modify: `apps/mobile/lib/platform/client.ts`
- Test: `apps/web/src/features/files/search/workspace-search-core.test.mts`
- Test: `apps/web/src/features/files/search/workspace-search-service.test.ts` (new)

**Approach:**
- Replace empty catches and silent fallback catches in targeted files with explicit reporting + deterministic UX contract.
- Preserve compatibility for non-failing paths while making fallback branches observable and recoverable.

**Patterns to follow:**
- Existing files/search test structure and web notification/error boundary patterns.

**Test scenarios:**
- Happy path: core request/search/session flows keep current expected behavior.
- Error path: API/transport failure records context and surfaces actionable user state.
- Edge case: malformed/empty payloads do not throw uncaught errors and do not silently mask failure as success.
- Integration: representative web and mobile flow each satisfy loading/success/empty/partial/error matrix.
- Accessibility: failure and retry states preserve keyboard/focus and mobile accessibility behavior.

**Verification:**
- No empty catches or silent fallback catches remain in targeted files.
- Observable reporting hooks and deterministic UX recovery are present.

- [ ] **Unit 2 (P0): Resolve currently known web/mobile type and module breakages**

**Goal:** Clear known diagnostics blocking safe iteration.

**Requirements:** R2, R3

**Dependencies:** Unit 0, Unit 1

**Files:**
- Modify: `apps/web/src/app/docs/[[...slug]]/page.tsx`
- Modify: `apps/web/src/app/docs/layout.tsx`
- Modify: `apps/web/src/app/templates/[shareId]/page.tsx`
- Modify: `apps/mobile/app/auth/index.tsx`
- Modify: `apps/mobile/app/home.tsx`
- Modify: `apps/mobile/app/onboarding.tsx`
- Modify: `apps/mobile/app/share/[threadId].tsx`
- Modify: `apps/mobile/components/ui/Avatar.tsx`
- Modify: `apps/mobile/components/ui/SelectableUIText.tsx`
- Test: `apps/mobile/app/share/[threadId].test.tsx` (new)

**Approach:**
- Correct invalid type assumptions and broken module paths in known failing files.
- Remove implicit-any boundaries in affected route interaction handlers.

**Patterns to follow:**
- Existing app-router typing patterns in `apps/web/src/app`.
- Existing mobile alias/import conventions in active mobile modules.

**Test scenarios:**
- Happy path: docs/template routes compile and render expected typed structures.
- Error path: optional docs/template fields handled without unsafe type bypasses.
- Edge case: share route update callbacks remain correctly typed.
- Integration: auth/home/onboarding/share paths resolve component/module imports consistently.

**Verification:**
- Targeted-file diagnostics return zero errors.
- Active-surface diagnostic baseline is captured for `apps/web` and `apps/mobile` with explicit waiver list if any non-targeted diagnostics remain.

- [ ] **Unit 3 (P1): Complete high-value shared-UI migration and deprecation cleanup**

**Goal:** Reduce divergence between app-local UI behavior and shared primitives.

**Requirements:** R1, R4

**Dependencies:** Unit 2

**Files:**
- Modify: `packages/ui/src/primitives/checkbox.tsx`
- Modify: `packages/ui/src/primitives/scroll-area.tsx`
- Modify: `packages/ui/src/primitives/separator.tsx`
- Modify: `apps/web/src/components/ui/aether-loader.tsx`
- Modify: `apps/web/src/components/thread/tool-views/shared/LoadingState.tsx`
- Modify: `apps/web/src/components/thread/aether-computer/components/SystemInfoContent.tsx`
- Test: `packages/ui/src/primitives/checkbox.test.tsx` (new)
- Test: `packages/ui/src/primitives/scroll-area.test.tsx` (new)

**Approach:**
- Convert migration TODOs into completed migration outcomes or tracked deferrals with owner.
- Remove or replace deprecated active-surface pathways that are no longer valid for OpenCode-driven flows.

**Patterns to follow:**
- Current primitive architecture in `packages/ui/src/primitives/`.
- Existing web consumers of shared primitives.

**Test scenarios:**
- Happy path: migrated primitives behave correctly in consuming web components.
- Edge case: deprecated-path removal does not break existing route-level composition.
- Integration: thread/loading composition remains functional after cleanup.

**Verification:**
- Targeted deprecated markers are removed or converted into tracked deferrals.
- Shared primitives are source-of-truth for targeted UI behaviors.

- [ ] **Unit 4 (P1): Close mobile parity TODOs in navigation/settings critical flows**

**Goal:** Remove high-impact mobile TODO placeholders impacting user workflows.

**Requirements:** R1, R2

**Dependencies:** Unit 2

**Files:**
- Modify: `apps/mobile/app/(settings)/instances.tsx`
- Modify: `apps/mobile/app/home.tsx`
- Modify: `apps/mobile/hooks/ui/useSideMenu.ts`
- Modify: `apps/mobile/hooks/ui/useAgentManager.ts`
- Modify: `apps/mobile/components/pages/TriggerDetailPage.tsx`
- Test: `apps/mobile/hooks/ui/useSideMenu.test.ts` (new)
- Test: `apps/mobile/hooks/ui/useAgentManager.test.ts` (new)

**Approach:**
- Replace TODO placeholders with parity/remediation behavior only: wire to existing routes/contracts or provide explicit disabled-with-message UX.
- Do not introduce net-new backend-dependent flows; record such requests as tracked deferrals.

**Execution note:** In `apps/mobile/app/home.tsx`, Unit 2 owns type/import corrections first; Unit 4 only implements parity/TODO flow completion afterward.

**Patterns to follow:**
- Existing mobile navigation/action patterns in `app/(settings)` and `hooks/ui`.

**Test scenarios:**
- Happy path: configured menu/settings actions navigate to intended existing screens.
- Error path: unavailable capability yields deterministic message with recovery choice, not a no-op.
- Edge case: partial account/session state does not crash action hooks.
- Integration: settings/home action outcomes remain consistent with UX error-state contract.

**Verification:**
- Target TODOs are removed or converted to tracked deferrals with owner references.
- Critical navigation/settings parity actions are behaviorally complete.

- [ ] **Unit 5 (P1/P2): Enforce recurrence-prevention quality gates in scripts and CI**

**Goal:** Prevent reintroduction of reliability/type anti-patterns.

**Requirements:** R4

**Dependencies:** Units 1-4 (P1/P2 work begins only after Unit 1+2 P0 acceptance criteria are met)

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/mobile/package.json`
- Modify: `package.json`
- Modify: `.github/workflows/` (frontend/mobile quality workflow file(s))
- Test: `apps/web/src/features/files/search/workspace-search-core.test.mts`

**Approach:**
- Add explicit frontend/mobile lint/type/test tasks for local and CI parity.
- Enforce policy to block empty catches and silent fallback catches in active frontend/mobile paths.
- Use staged rollout (touched-files policy and/or baseline allowlist) before full enforcement.
- Define exact required check names/jobs so completion is objective.

**Patterns to follow:**
- Existing root/app script conventions and workflow structures.

**Test scenarios:**
- Happy path: CI passes on compliant frontend/mobile changes.
- Error path: introduced empty catch is blocked.
- Error path: introduced silent fallback catch is blocked.
- Integration: root-level quality commands cover web + mobile consistently.

**Verification:**
- Required checks are explicit and running in CI (web lint/type/test; mobile lint/type/test or approved substitute; UI package verification).
- CI fails on targeted recurrence anti-patterns.

## System-Wide Impact

- **Interaction graph:** Affects web session/chat/file rendering, mobile navigation/settings hooks, and shared primitive behavior.
- **Error propagation:** Moves from silent-fail to explicit, recoverable failure paths.
- **State lifecycle risks:** Hardening may expose latent assumptions; staged unit rollout controls blast radius.
- **API surface parity:** No intentional backend contract expansion; parity improvements stay within existing contracts.
- **Integration coverage:** Cross-layer tests required where UI hooks, wrappers, and route surfaces intersect.
- **Unchanged invariants:** No intentional backend endpoint contract changes.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Making failures visible increases short-term surfaced issues | Stage by critical path and provide deterministic recovery UX |
| Type/module fixes ripple to adjacent files | Constrain by bounded file clusters with per-unit diagnostic verification |
| Shared-UI migration causes regressions | Add primitive-focused tests and verify key consuming routes/screens |
| Quality-gate rollout blocks unrelated work | Start with touched-files/baseline allowlist and burn down incrementally |

## Documentation / Operational Notes

- Update contributor guidance for frontend/mobile quality commands and catch-policy enforcement.
- Maintain a short remediation changelog (P0/P1/P2 status) during execution.

## Sources & References

- Related code: `apps/web/src/app/`, `apps/web/src/components/`, `apps/web/src/features/`, `apps/mobile/app/`, `apps/mobile/components/`, `apps/mobile/lib/`, `packages/ui/src/primitives/`
- Supporting context: `CLAUDE.md`, `docs/development-guide.md`
