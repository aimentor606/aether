#!/usr/bin/env bash
# Rollback the last N database migrations.
#
# Usage:
#   ./rollback.sh              # Roll back the last migration
#   ./rollback.sh 2            # Roll back the last 2 migrations
#   ./rollback.sh --dry-run    # Show what would run without executing
#
# Prerequisites:
#   DATABASE_URL env var must be set (or .env file with it)
#
# Rollback SQL files follow the naming convention:
#   0001_vertical_tables.sql → 0001_rollback.sql
#   0002_enable_rls.sql      → 0002_rollback.sql
#
# Baseline (0000) has no rollback by design.

set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
DRY_RUN=false
STEPS=1

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    *) STEPS="$arg" ;;
  esac
done

# Load DATABASE_URL from .env if not set
if [ -z "${DATABASE_URL:-}" ]; then
  for envfile in "$DIR/../.env" "$DIR/../../../.env"; do
    if [ -f "$envfile" ]; then
      # shellcheck disable=SC1090
      source "$envfile"
      break
    fi
  done
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set. Export it or create a .env file."
  exit 1
fi

# Find rollback files in reverse order
ROLLBACKS=()
for f in $(ls -r "$DIR"/[0-9]*_rollback.sql 2>/dev/null); do
  ROLLBACKS+=("$f")
done

if [ ${#ROLLBACKS[@]} -eq 0 ]; then
  echo "No rollback files found in $DIR"
  exit 0
fi

TO_RUN=()
for f in "${ROLLBACKS[@]}"; do
  if [ ${#TO_RUN[@]} -ge "$STEPS" ]; then
    break
  fi
  TO_RUN+=("$f")
done

echo "Rolling back ${#TO_RUN[@]} migration(s)..."

for f in "${TO_RUN[@]}"; do
  BASENAME=$(basename "$f")
  # Derive the forward migration name from rollback filename
  FORWARD="${BASENAME/_rollback/}"
  echo "  $BASENAME (reverses $FORWARD)"

  if [ "$DRY_RUN" = true ]; then
    echo "    [DRY RUN] Would execute: $f"
  else
    echo "    Executing..."
    psql "$DATABASE_URL" -f "$f" -v ON_ERROR_STOP=1
    if [ $? -eq 0 ]; then
      echo "    OK"
    else
      echo "    FAILED. Stopping rollback."
      exit 1
    fi
  fi
done

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Dry run complete. No changes were made."
else
  echo ""
  echo "Rollback complete."
fi
