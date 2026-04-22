---
description: "Full review team. Spawns correctness, security, performance, reliability, maintainability, and testing reviewers in parallel."
agent: aether
---

# Full Review Team

You are running the full review team. Spawn 6 specialist review agents in parallel as async workers.

## Step 1: Get the diff

```bash
git fetch origin <base> --quiet
git diff origin/<base> --stat
```

If no diff, report "Nothing to review" and stop.

## Step 2: Save diff to file for agents to read

```bash
git diff origin/<base> > /tmp/review-diff.txt
git diff origin/<base> --stat > /tmp/review-diff-stat.txt
```

## Step 3: Spawn all 6 reviewers in parallel

Use `agent_spawn` with `async: true` for each. Each agent reads the diff from `/tmp/review-diff.txt`.

Spawn these agents from `agents/`:

1. **correctness-reviewer** — logic errors, edge cases, state management bugs
2. **security-reviewer** — auth, input validation, OWASP
3. **performance-reviewer** — DB queries, caching, complexity
4. **reliability-reviewer** — error handling, retries, timeouts
5. **maintainability-reviewer** — abstractions, coupling, naming
6. **testing-reviewer** — coverage gaps, weak assertions

For each agent, use:
```
agent_spawn(
  description: "<specialist> review",
  prompt: "Read the diff at /tmp/review-diff.txt. Review for <specialist focus area>. Output findings as: [CRITICAL|INFO] file:line — problem -> fix. Only report real issues, not style preferences.",
  agent_type: "<agent-name>",
  async: true
)
```

## Step 4: Collect and synthesize

As each `<agent_completed>` message arrives:
- Collect findings
- Deduplicate across reviewers
- Classify as CRITICAL or INFORMATIONAL

## Step 5: Present unified report

```
REVIEW REPORT
Files changed: N | Agents: 6 | Findings: N (CRITICAL: X, INFO: Y)

[Grouped findings by file, with severity and recommended fix]
```

## Step 6: Fix-First

Apply AUTO-FIX items directly. Present ASK items via question tool.
