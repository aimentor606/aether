#!/bin/bash
cd "$(dirname "$0")/.."
SERVICES="kong|postgres|redis|llm-proxy"
if [ -z "$1" ] || ! echo "$1" | grep -qE "^($SERVICES)$"; then
  echo "Usage: $0 <kong|postgres|redis|llm-proxy> [tail lines]"
  echo ""
  echo "  kong       — Kong gateway logs"
  echo "  postgres   — PostgreSQL logs"
  echo "  redis      — Redis logs"
  echo "  llm-proxy  — LLM proxy logs (NewAPI or LiteLLM)"
  exit 1
fi
LINES="${2:-100}"
docker logs "$1" --tail "$LINES" -f
