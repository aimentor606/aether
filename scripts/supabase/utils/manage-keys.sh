#!/bin/sh
# Unified key management for self-hosted Supabase.
#
# Dispatches to specialized scripts under supabase/utils/.
#
# Usage:
#   sh manage-keys.sh generate          # Generate all secrets + JWT keys
#   sh manage-keys.sh add-auth          # Add asymmetric key pair + opaque API keys
#   sh manage-keys.sh rotate-api        # Rotate opaque API keys only
#   sh manage-keys.sh reset-passwords   # Reset all DB role passwords
#
# All subcommands support --update-env flag to write changes to .env.

set -e

UTILS_DIR="$(cd "$(dirname "$0")" && pwd)"

usage() {
  cat <<'EOF'
Usage: manage-keys.sh <command> [options]

Commands:
  generate          Generate all secrets + JWT keys (first-time setup)
  add-auth          Add asymmetric key pair + opaque API keys
  rotate-api        Rotate opaque API keys (non-breaking)
  reset-passwords   Reset all DB role passwords

Options:
  --update-env      Write changes to .env (otherwise print only)

Examples:
  sh manage-keys.sh generate --update-env    # Initial setup
  sh manage-keys.sh rotate-api --update-env  # Key rotation
EOF
  exit 0
}

if [ $# -lt 1 ]; then
  usage
fi

COMMAND="$1"
shift

case "$COMMAND" in
  generate)
    exec sh "$UTILS_DIR/generate-keys.sh" "$@"
    ;;
  add-auth)
    exec sh "$UTILS_DIR/add-new-auth-keys.sh" "$@"
    ;;
  rotate-api)
    exec sh "$UTILS_DIR/rotate-new-api-keys.sh" "$@"
    ;;
  reset-passwords)
    exec sh "$UTILS_DIR/db-passwd.sh" "$@"
    ;;
  *)
    echo "Unknown command: $COMMAND"
    usage
    ;;
esac
