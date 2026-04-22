---
description: "Multi-perspective code review. Spawns specialized review agents in parallel for correctness, security, performance, and more."
agent: aether
---

# Smart Review

You are running `/review`. This performs a diff-aware review that spawns the right specialists based on what changed.

## Step 1: Get the diff

```bash
git fetch origin <base> --quiet
git diff origin/<base> --stat
```

If no diff, report "Nothing to review" and stop.

## Step 2: Save diff for agents

```bash
git diff origin/<base> > /tmp/review-diff.txt
```

## Step 3: Analyze diff scope

Read `/tmp/review-diff.txt` and determine which specialist agents to spawn:

| If diff contains... | Spawn these agents |
|---|---|
| SQL, migrations, schema changes | data-integrity-guardian, data-migrations-reviewer |
| Auth, sessions, tokens, permissions | security-reviewer, security-sentinel |
| API routes, request/response types | api-contract-reviewer, correctness-reviewer |
| Frontend, CSS, components | pattern-recognition-specialist, maintainability-reviewer |
| Loops, caching, DB queries | performance-reviewer, performance-oracle |
| Error handling, retries | reliability-reviewer |
| Test files | testing-reviewer |
| Config, CI, deploy | deployment-verification-agent |
| Large diff (>10 files) | architecture-strategist |
| Any code change | correctness-reviewer (always) |

**Minimum:** Always spawn correctness-reviewer. Add specialists based on scope.

## Step 4: Spawn agents in parallel

Use `agent_spawn` with `async: true` for each selected agent. All agents read from `/tmp/review-diff.txt`.

```
agent_spawn(
  description: "Correctness review",
  prompt: "Read /tmp/review-diff.txt. Review for logic errors, edge cases, state management bugs. Format: [CRITICAL|INFO] file:line — problem -> fix",
  agent_type: "correctness-reviewer",
  async: true
)
```

## Step 5: Collect and synthesize

As `<agent_completed>` messages arrive, collect all findings. Deduplicate, classify severity.

## Step 6: Fix-First Review

Apply AUTO-FIX items directly. Present ASK items via question tool.

Output:
```
[FIXED] file:line — problem -> what you did
[ASK] file:line — problem -> recommended fix (A: Fix, B: Skip)
```
