#!/bin/bash
# Generate random secrets for deploy/ops/.env
#
# Reads ops/.env.example and replaces all CHANGE_ME / sk-CHANGE_ME placeholders
# with cryptographically random values.
#
# Usage:
#   bash ops/gen-secrets.sh                  # preview to stdout
#   bash ops/gen-secrets.sh > ops/.env       # write to file

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXAMPLE="$SCRIPT_DIR/.env.example"

if [ ! -f "$EXAMPLE" ]; then
  echo "ERROR: $EXAMPLE not found" >&2
  exit 1
fi

gen_pass() { openssl rand -hex 16; }
gen_key()  { echo "sk-$(openssl rand -hex 24)"; }
gen_cluster_id() { openssl rand -hex 12 | tr 'a-f' 'A-F' | fold -w2 | paste -sd '' -; }

while IFS= read -r line; do
  if [[ "$line" =~ ^[A-Z_]+=CHANGE_ME$ ]]; then
    var="${line%%=*}"
    echo "$var=$(gen_pass)"
  elif [[ "$line" =~ ^[A-Z_]+=sk-CHANGE_ME$ ]]; then
    var="${line%%=*}"
    echo "$var=$(gen_key)"
  elif [[ "$line" =~ ^KAFKA_CLUSTER_ID=CHANGE_ME$ ]]; then
    echo "KAFKA_CLUSTER_ID=$(gen_cluster_id)"
  else
    echo "$line"
  fi
done < "$EXAMPLE"
