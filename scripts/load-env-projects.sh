#!/usr/bin/env bash
# Source .env.projects.local into the shell (export all non-comment lines).
# Usage: eval "$(bash scripts/load-env-projects.sh)"

set -euo pipefail
FILE="$(cd "$(dirname "$0")/.." && pwd)/.env.projects.local"
if [[ ! -f "$FILE" ]]; then
  echo "echo 'Missing .env.projects.local'" >&2
  exit 1
fi
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  [[ -z "${line// }" ]] && continue
  key="${line%%=*}"
  val="${line#*=}"
  printf 'export %q=%q\n' "$key" "$val"
done < "$FILE"
