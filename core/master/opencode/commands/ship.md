---
description: "Ship workflow: merge base branch, run tests, review diff, bump VERSION, update CHANGELOG, commit, push, create PR."
agent: aether
---

# Ship Workflow

You are running `/ship`. This is the complete ship pipeline from merge to PR.

## Step 1: Pre-flight

```bash
git branch --show-current
git status --porcelain
git fetch origin <base> --quiet
git diff origin/<base> --stat
```

If on base branch or no diff: report and stop.
If dirty working tree: ask user to commit/stash first.

## Step 2: Merge base

```bash
git fetch origin <base>
git merge origin/<base> --no-edit
```

Resolve conflicts if any. Report merge result.

## Step 3: Run tests

Run the project's test command (read from project config or CLAUDE.md).

If tests fail: **STOP. Fix failures before shipping.**

## Step 4: Review

Spawn a focused review using the most relevant agents:

```bash
git diff origin/<base> > /tmp/ship-diff.txt
```

Spawn `correctness-reviewer` and any scope-relevant agents via `agent_spawn(async: true)`. Collect findings. Fix CRITICAL issues. Present ASK items via question tool.

## Step 5: Version bump

Read current VERSION file. Determine bump type:
- New feature → minor bump
- Bug fix → patch bump
- Breaking change → major bump

Update VERSION file.

## Step 6: Update CHANGELOG

Add a new entry at the top of CHANGELOG.md covering all changes on this branch vs base. Write user-facing descriptions, not implementation details.

## Step 7: Commit

```bash
git add VERSION CHANGELOG.md
git commit -m "chore: bump version to <new-version>"
```

## Step 8: Push

```bash
git push -u origin <branch>
```

## Step 9: Create or update PR

Use `gh pr create` or `gh pr edit`. Include:
- Title from CHANGELOG entry
- Body with summary + test plan
- Labels if applicable

## Step 10: Report

```
SHIP REPORT
Branch: <branch> → <base>
Version: <old> → <new>
Tests: PASS | FAIL
Review: N findings (X critical, Y fixed)
PR: <url>
Status: SHIPPED | BLOCKED
```
