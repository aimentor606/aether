# Aether UI/UX Redesign TODO

## Design System
- [x] Create DESIGN.md (Dark Industrial + Teal + Satoshi)
- [x] Update CLAUDE.md with design system reference

## User Journey Analysis

### Landing Page Journey (`/`)
- [x] Analyzed: hero -> scroll drawer -> floating CTA -> navbar behavior
- **Issue:** Hero CTA uses `window.location.href` (full reload) while navbar uses `router.push` (client nav) — inconsistent
- **Issue:** No clipboard error handling on install command copy
- **Issue:** No progressive loading state — page jumps from blank to fully rendered
- **Issue:** DashboardPromoBanner is imported in home layout but never rendered — dead bundle weight

### Auth Journey (`/auth`)
- [x] Analyzed: lock screen -> form -> magic link/OAuth -> email check -> OTP/callback
- **Issue:** Lock screen adds unnecessary friction (extra click/keypress before form visible)
- **Issue:** No URL param to skip lock screen (`/auth?phase=form`)
- **Issue:** `isLoading` spinner blocks entire page — no wallpaper/clock visible during auth check
- **Issue:** `returnUrl` strips instance-scoped paths — user sent to instance picker, not previous instance
- **Issue:** GDPR checkbox disables submit with no tooltip explaining why
- **Issue:** No client-side email validation before submission

### Instance List Journey (`/instances`)
- [x] Analyzed: list -> auto-create -> auto-redirect -> instance card click
- **Issue:** Local auto-create shows only spinning button — no progress for Docker image pull
- **Issue:** After Stripe checkout return, no "Your instance is being provisioned" message
- **Issue:** Auto-create failure shows toast but no diagnostics or recovery steps

### Instance Detail / Provisioning (`/instances/[id]`)
- [x] Analyzed: loading -> provisioning (SSE + fallback) -> health gate -> redirecting
- **Issue:** Health gate adds 3-30+ seconds after "active" with no clear explanation
- **Issue:** No cancel button during provisioning — back button is only option
- **Issue:** SSE fallback to HTTP polling has no user-visible indication
- **Issue:** Local Docker provisioning jumps progress bar (no SSE, only 2s polling)

### Onboarding Flow
- [x] Analyzed: BIOS animation -> setup wizard (7-8 steps) -> onboarding chat -> morph to dashboard
- **Issue:** BIOS boot animation cannot be interrupted during line printing (~4s minimum)
- **Issue:** Setup wizard has 7-8 steps even though most can be skipped — feels lengthy
- **Issue:** Onboarding check 1s timeout fails open — user could reach dashboard without confirmation
- **Issue:** Onboarding chat creation can silently fail, liveness fallback takes 8s to kick in
- **Issue:** No way to re-trigger setup wizard without `?onboarding-redo` URL param

### Dashboard Layout
- [x] Analyzed: skeleton -> auth check -> onboarding check -> providers mount -> chrome renders
- **Issue:** Onboarding check timeout (1s) fails open for slow sandboxes
- **Issue:** No explicit ErrorBoundary — unhandled error in any pre-mounted tab crashes all tabs
- **Issue:** Sidebar mutual exclusion relies on fragile custom DOM events

### Left Sidebar
- [x] Analyzed: collapsed/expanded states, session list, projects, keyboard shortcuts
- **Issue:** Cmd+J for new session is not discoverable
- **Issue:** Session list is flat with no inline search/filter — overwhelming for many sessions

### Right Sidebar
- [x] Analyzed: quick actions, terminal creation, service links
- **Issue:** Right sidebar defaults to icon-only — new users don't discover terminal/browser/desktop tools
- **Issue:** No onboarding tooltip or hint for first-time users

### Tab System
- [x] Analyzed: pre-mounted tabs, tab store, route sync, drag/drop, keyboard shortcuts
- **Issue:** ALL open tabs mounted in DOM simultaneously — memory pressure for power users
- **Issue:** `closingTabIds` ref for race prevention depends on pathname comparison — fragile
- **Issue:** File tab dirty confirmation uses `window.confirm` — visual inconsistency
- **Issue:** No tab limit — unlimited tabs allowed

### Dashboard Home
- [x] Analyzed: wallpaper -> chat input -> session creation -> navigation
- **Issue:** Session creation race condition mitigated by ordering sessionStorage write before navigation

### Session/Chat
- [x] Analyzed: message flow, agent/model selector, file attachments, @ mentions, slash commands, tool panel
- **Issue:** Message queue (busy session) only shows "Queue" button text change — no toast/animation
- **Issue:** Token progress indicator shifts color but no numeric context window usage shown

### Settings
- [x] Analyzed: credentials, providers, API keys pages
- **Issue:** Settings pages opened as lazy-loaded tabs — no obvious "back to settings" navigation

### Instance Switching
- [x] Analyzed: server store swap, tab store save/restore, SSE reconnection, connecting screen
- **Issue:** Full page state reset on switch (queries invalidated, SSE reconnected) — active sessions interrupted
- **Issue:** No "switching..." transitional state in sidebar — entire page goes through connection cycle
- **Issue:** `swapForServer()` localStorage save fails silently — tabs lost with no feedback
- **Issue:** No UI to reset `userSelected` flag (cannot "undo" manual instance selection)

## UX Issues (prioritized)

### P0 — High Impact
- [x] Unified post-login loading experience: Single "Setting up your Aether" progress page replacing 3-4 redirect chain
- [x] Explain `/dashboard` redirect when no active instance: `?reason=no-instance` + banner
- [x] Tab memory management: Tab limit (15), unmount inactive tabs, warn on memory pressure
- [x] Add ErrorBoundary to SessionTabsContainer — prevent single tab crash from killing all tabs

### P1 — Medium Impact
- [ ] Skip lock screen for direct navigation: `/auth?phase=form` URL parameter
- [ ] Tab state save failure feedback: Toast when localStorage save fails during instance switch
- [ ] Auto-create failure diagnostics: Error details + recovery steps when sandbox creation fails
- [ ] Fix error page "Return Home" destination: `/instances` instead of `/` for authenticated users
- [x] Fix hero CTA routing inconsistency: Use `router.push` everywhere, not `window.location.href`
- [ ] Add cancel provisioning button
- [ ] Health gate feedback: Show "Waiting for services to start..." instead of silent spinner

### P2 — Lower Impact
- [ ] Right sidebar discoverability: Onboarding tooltip after first dashboard load
- [ ] Command palette discoverability: Visible trigger button or hint
- [ ] Mobile tab memory optimization
- [ ] Replace `window.confirm` with styled dialog for unsaved file changes
- [ ] Instance switching transitional state in sidebar
- [ ] Onboarding skip URL param for marketing site buttons
- [ ] Message queue visual feedback (toast/animation when queuing)
- [ ] BIOS boot animation skip (Enter key should work from start, not after lines print)

## Implementation
- [x] Apply DESIGN.md tokens to globals.css (replace current oklch neutrals with zinc/teal system)
- [x] Add Satoshi + JetBrains Mono font loading
- [ ] Refactor landing page with new design system
- [ ] Refactor dashboard layout with new design system
- [ ] Implement P0 UX fixes
- [ ] Implement P1 UX fixes
