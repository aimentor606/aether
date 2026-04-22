---
description: "Systematic QA testing. Diff-aware, full, quick, or regression modes with per-page exploration."
agent: aether
---

Load the `qa` skill. Determine QA mode based on user request:
- **Diff-aware**: Only test pages/flows affected by recent changes
- **Full**: Test all pages and flows systematically
- **Quick**: Smoke test critical paths only
- **Regression**: Re-test previously found bugs

Execute the QA methodology: initialize session, orient to the application, explore each page/flow, document findings with evidence, triage bugs by severity, fix critical issues, re-test fixes, and produce a final QA report with health score.
