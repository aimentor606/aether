---
description: "Systematic root cause investigation. 5-phase debugging with Iron Law: no fixes without investigation."
agent: aether
---

# Systematic Investigation

You are running `/investigate`. Follow the 5-phase debugging methodology.

**IRON LAW: NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.**

## Phase 1: Root Cause Investigation

Gather context before forming any hypothesis.

1. **Collect symptoms:** Read the error messages, stack traces, reproduction steps. If insufficient context, ask ONE question at a time via question tool.

2. **Read the code:** Trace the code path from the symptom back to potential causes. Use grep to find all references, read to understand the logic.

3. **Check recent changes:**
   ```bash
   git log --oneline -20 -- <affected-files>
   ```
   Was this working before? What changed?

4. **Reproduce:** Can you trigger the bug deterministically? If not, gather more evidence.

5. **Check history:** Check for prior investigations in the same files. Recurring bugs in the same area are an architectural smell.

Output: **"Root cause hypothesis: ..."** — a specific, testable claim.

## Phase 2: Pattern Analysis

Classify the bug against known patterns:

| Pattern | Signature | Where to look |
|---------|-----------|---------------|
| Race condition | Intermittent, timing-dependent | Concurrent access to shared state |
| Nil/null propagation | NoMethodError, TypeError | Missing guards on optional values |
| State corruption | Inconsistent data, partial updates | Transactions, callbacks, hooks |
| Integration failure | Timeout, unexpected response | External API calls, service boundaries |
| Configuration drift | Works locally, fails in staging/prod | Env vars, feature flags, DB state |
| Stale cache | Shows old data, fixes on cache clear | Redis, CDN, browser cache |

If no match, search the web for `"{framework} {generic error type}"` — sanitize first.

## Phase 3: Hypothesis Testing

Before writing ANY fix, verify your hypothesis.

1. Add temporary debug output at the suspected root cause. Run reproduction. Does evidence match?
2. If wrong: form next hypothesis, return to Phase 1.
3. **3-strike rule:** If 3 hypotheses fail, STOP and ask the user:
   - A) Continue — new hypothesis: [describe]
   - B) Escalate for human review
   - C) Add logging and wait

## Phase 4: Implementation

Once root cause confirmed:

1. Fix the root cause, not the symptom. Smallest change.
2. Minimal diff: fewest files, fewest lines.
3. Write a regression test that fails without fix, passes with fix.
4. Run full test suite. No regressions.
5. If fix touches >5 files: ask about blast radius.

## Phase 5: Verification & Report

Reproduce original bug. Confirm fixed. Run test suite.

```
DEBUG REPORT
Symptom:         [what the user observed]
Root cause:      [what was actually wrong]
Fix:             [file:line references]
Evidence:        [test output showing fix works]
Regression test: [file:line]
Status:          DONE | DONE_WITH_CONCERNS | BLOCKED
```
