#!/bin/bash
cd "$(dirname "$0")/.."
SERVICES="kong|llm-proxy"
if [ -z "$1" ] || ! echo "$1" | grep -qE "^($SERVICES)$"; then
  echo "Usage: $0 <kong|llm-proxy> [tail lines]"
  echo ""
  echo "  kong       — Kong gateway logs"
  echo "  llm-proxy  — LLM proxy logs (NewAPI or LiteLLM)"
  echo ""
  echo "For PG/Redis logs, use: docker logs supabase-db or docker logs supabase-redis"
  exit 1
fi
LINES="${2:-100}"
docker logs "$1" --tail "$LINES" -f
