#!/bin/bash
# Validates all agent, skill, and command files have correct YAML frontmatter
# Usage: bash validate-artifacts.sh [--fix]

set -euo pipefail
BASE="/Users/dbing/Project/aether/core/master/opencode"
ERRORS=0
WARNINGS=0

echo "=== Validating aether artifacts ==="
echo ""

# 1. Validate agents (root + subdirectories)
echo "--- Agents ---"
AGENT_COUNT=0
for f in $(find "$BASE/agents" -name "*.md" -type f 2>/dev/null); do
  AGENT_COUNT=$((AGENT_COUNT + 1))

  # Check frontmatter exists
  FIRST=$(head -1 "$f")
  if [ "$FIRST" != "---" ]; then
    echo "ERROR: $f - missing opening ---"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  # Check required fields
  if ! grep -q "^description:" "$f"; then
    echo "ERROR: $f - missing description field"
    ERRORS=$((ERRORS + 1))
  fi

  if ! grep -q "^mode:" "$f"; then
    echo "ERROR: $f - missing mode field"
    ERRORS=$((ERRORS + 1))
  fi

  if ! grep -q "^permission:" "$f"; then
    echo "ERROR: $f - missing permission field"
    ERRORS=$((ERRORS + 1))
  fi

  # Check description is not empty
  DESC=$(grep "^description:" "$f" | sed 's/^description: *//' | sed 's/^"//' | sed 's/"$//')
  if [ -z "$DESC" ] || [ "$DESC" = '""' ]; then
    echo "ERROR: $f - empty description"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "Agents checked: $AGENT_COUNT"

# 2. Validate skills
echo ""
echo "--- Skills ---"
SKILL_COUNT=0
for f in $(find "$BASE/skills" -name "SKILL.md" -type f 2>/dev/null); do
  SKILL_COUNT=$((SKILL_COUNT + 1))

  FIRST=$(head -1 "$f")
  if [ "$FIRST" != "---" ]; then
    echo "ERROR: $f - missing opening ---"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if ! grep -q "^name:" "$f"; then
    echo "WARN: $f - missing name field"
    WARNINGS=$((WARNINGS + 1))
  fi

  if ! grep -q "^description:" "$f"; then
    echo "ERROR: $f - missing description field"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "Skills checked: $SKILL_COUNT"

# 3. Validate commands
echo ""
echo "--- Commands ---"
CMD_COUNT=0
for f in $(find "$BASE/commands" -name "*.md" -type f 2>/dev/null); do
  CMD_COUNT=$((CMD_COUNT + 1))

  FIRST=$(head -1 "$f")
  if [ "$FIRST" != "---" ]; then
    echo "ERROR: $f - missing opening ---"
    ERRORS=$((ERRORS + 1))
    continue
  fi

  if ! grep -q "^description:" "$f"; then
    echo "ERROR: $f - missing description field"
    ERRORS=$((ERRORS + 1))
  fi
done
echo "Commands checked: $CMD_COUNT"

# Summary
echo ""
echo "=== Summary ==="
echo "Errors: $ERRORS"
echo "Warnings: $WARNINGS"
echo "Total agents: $AGENT_COUNT"
echo "Total skills: $SKILL_COUNT"
echo "Total commands: $CMD_COUNT"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "FAIL: $ERRORS errors found"
  exit 1
else
  echo ""
  echo "PASS: All artifacts valid"
  exit 0
fi
