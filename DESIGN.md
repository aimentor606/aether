# Design System — Aether

## Product Context
- **What this is:** Autonomous company operating system — AI agents run in isolated Linux sandboxes, executing code and managing infrastructure 24/7
- **Who it's for:** CTOs at startups who need autonomous agents with vertical domain specialization
- **Space/industry:** AI/agent infrastructure, SaaS with credit-based billing
- **Project type:** Web app + dashboard (dense, power-user oriented)

## Aesthetic Direction
- **Direction:** Dark Industrial — infrastructure control panel, not a consumer dashboard
- **Decoration level:** Minimal — typography and color do all the work
- **Mood:** The feeling of looking at a well-designed terminal or monitoring system. Dense data, crisp hierarchy, everything scannable at a glance. A CTO should know exactly what their agents are doing without clicking anything.
- **Reference sites:** Linear (density), Raycast (dark-only crispness), Cursor (warm restraint)

## Typography
- **Display + Body:** Satoshi — geometric sans with personality. Works at 13px (dense) and 48px (hero). Tight default spacing. The `a` and `g` shapes give it a distinctive silhouette.
- **Code/Data:** JetBrains Mono — for instance IDs, terminal output, agent status labels, token counts. Used sparingly as an accent typeface.
- **Loading:** Google Fonts CDN or `@fontsource/atkinson-hyperlegible` (Satoshi via `@fontsource` or Bunny Fonts), `JetBrains Mono` via Google Fonts
- **Scale:**
  - 11px — micro labels, timestamps
  - 13px — body text (the default — dense)
  - 14px — UI labels, form inputs
  - 16px — small headings
  - 20px — section headings
  - 32px — page titles
  - 48px — hero display
- **Tracking:** -0.02em above 20px, -0.04em above 32px
- **Weight range:** 400 (body), 500 (labels), 600 (headings), 700 (hero only)

## Color
- **Approach:** Restrained — one accent (teal) used surgically. Color is rare and meaningful.

### Dark mode (PRIMARY — the default)
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Background | `#09090B` | zinc-950 | Neutral near-black |
| Surface 1 | `#18181B` | zinc-900 | Cards, sidebar |
| Surface 2 | `#27272A` | zinc-800 | Elevated elements |
| Surface 3 | `#3F3F46` | zinc-700 | Hover/active |
| Text primary | `#FAFAFA` | zinc-50 | Main text |
| Text secondary | `#A1A1AA` | zinc-400 | Muted text |
| Text tertiary | `#71717A` | zinc-500 | Hint text |
| Border | `rgba(255,255,255,0.06)` | — | Translucent hairline |
| Border hover | `rgba(255,255,255,0.10)` | — | Hovered border |
| Accent | `#2DD4BF` | teal-400 | Agent active, primary CTA |
| Accent dimmed | `#0D9488` | teal-600 | Subtle agent status |
| Accent hover | `#5EEAD4` | teal-300 | Accent hover |

### Light mode (SECONDARY — override)
| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Background | `#FAFAFA` | zinc-50 | Page background |
| Surface | `#F4F4F5` | zinc-100 | Cards, panels |
| Text primary | `#09090B` | zinc-950 | Main text |
| Text muted | `#71717A` | zinc-500 | Muted text |
| Border | `#E4E4E7` | zinc-200 | Borders |
| Accent | `#0D9488` | teal-600 | Primary CTA |
| Accent hover | `#0F766E` | teal-700 | Accent hover |

### Semantic
| State | Hex | Tailwind |
|-------|-----|----------|
| Success | `#22C55E` | green-500 |
| Warning | `#EAB308` | yellow-500 |
| Error | `#EF4444` | red-500 |
| Info | `#3B82F6` | blue-500 |

### Why these choices
- **Teal accent:** The color of active monitoring dashboards, terminal highlights, system health. It reads as "this infrastructure is alive." Nobody in the AI/agent space uses teal as primary.
- **Neutral zinc:** Dense dark UIs feel cleaner with neutral grays. Warm tints add warmth but reduce the crisp, industrial feel that makes dense layouts readable.

## Spacing
- **Base unit:** 4px
- **Density:** Compact — every pixel earns its place
- **Scale:** 2xs(2) xs(4) sm(6) md(12) lg(16) xl(24) 2xl(32) 3xl(48)
- **Cards:** p-3, **Gaps:** 8px, **Section rhythm:** 64px

## Layout
- **Approach:** Grid-disciplined, maximum density
- **Grid:** 12-column. Sidebar (240px) + main content.
- **Max content width:** 1280px
- **Border radius:**
  - sm: 4px (badges, small elements)
  - md: 6px (cards, buttons, inputs)
  - lg: 8px (panels, modals)
  - full: 9999px (pills, status dots)
- **Depth:** Surface ladder only — no drop shadows. 4 luminance steps (background → surface 1 → surface 2 → surface 3).

## Motion
- **Approach:** Minimal-functional — transitions serve comprehension only
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(80ms) short(100-150ms) medium(150-250ms) long(250-400ms)
- **Agent pulse:** Teal dot with subtle opacity animation (1.5s cycle) — the only decorative animation, and it's functional
- **No scroll animations, no parallax, no reveal effects**

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-07 | Design system replaced | Dark + dense direction replacing Apple-inspired system. Inspired by Linear/Raycast density. Teal accent for "active monitoring" identity. Satoshi for distinctive typography. 13px body for power-user density. |
