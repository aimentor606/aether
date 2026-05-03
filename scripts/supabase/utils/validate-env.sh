#!/bin/bash
# Validate that Supabase secrets are not still using demo/placeholder values.
#
# Usage: bash validate-env.sh
# Exit 1 if any secret matches a known insecure value.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: $ENV_FILE not found. Copy .env.example and update values." >&2
  exit 1
fi

source "$ENV_FILE"

ERRORS=0

check_not() {
  local var="$1" bad_val="$2"
  if [ "${!var}" = "$bad_val" ]; then
    echo "ERROR: $var is still set to a demo placeholder. Generate a unique value." >&2
    ERRORS=$((ERRORS + 1))
  fi
}

check_not "POSTGRES_PASSWORD" "your-super-secret-and-long-postgres-password"
check_not "JWT_SECRET" "your-super-secret-jwt-token-with-at-least-32-characters-long"
check_not "JWT_SECRET" "super-secret-jwt-token-with-at-least-32-characters-long"

# ANON_KEY and SERVICE_ROLE_KEY from .env.example are publicly known demo JWTs.
# Check that they don't start with the demo issuer prefix.
if [ -n "${ANON_KEY:-}" ]; then
  DEMO_PAYLOAD="eyJyb2xlIjoiYW5vbiIsImlhdCI6MTY0Mz"
  if echo "$ANON_KEY" | cut -d. -f2 | base64 -d 2>/dev/null | grep -q '"supabase-demo"' 2>/dev/null; then
    echo "ERROR: ANON_KEY uses demo issuer 'supabase-demo'. Generate unique JWT keys." >&2
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ -n "${SERVICE_ROLE_KEY:-}" ]; then
  if echo "$SERVICE_ROLE_KEY" | cut -d. -f2 | base64 -d 2>/dev/null | grep -q '"supabase-demo"' 2>/dev/null; then
    echo "ERROR: SERVICE_ROLE_KEY uses demo issuer 'supabase-demo'. Generate unique JWT keys." >&2
    ERRORS=$((ERRORS + 1))
  fi
fi

if [ "$ERRORS" -gt 0 ]; then
  echo "Found $ERRORS insecure value(s). Fix them before deploying to production." >&2
  exit 1
fi

echo "All secrets validated. No demo/placeholder values detected."
