#!/usr/bin/env bash
# Copy STAGING_* or PROD_* Supabase vars from .env.projects.local into .env.local
# (unprefixed names Next.js and most npm scripts expect).
#
# Usage:
#   bash scripts/sync-env-from-projects.sh staging   # default — local dev
#   bash scripts/sync-env-from-projects.sh prod      # rare; prod script debugging only

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${1:-staging}"
PROJECTS="$ROOT/.env.projects.local"
LOCAL="$ROOT/.env.local"

if [[ ! -f "$PROJECTS" ]]; then
  echo "Missing $PROJECTS — copy .env.projects.example first."
  exit 1
fi

if [[ ! -f "$LOCAL" ]]; then
  echo "Missing $LOCAL — copy .env.local.example first."
  exit 1
fi

case "$TARGET" in
  staging) PREFIX=STAGING_ ;;
  prod) PREFIX=PROD_ ;;
  *)
    echo "Usage: $0 [staging|prod]"
    exit 1
    ;;
esac

get_var() {
  grep "^${1}=" "$PROJECTS" | head -1 | cut -d= -f2- | tr -d '\r'
}

URL="$(get_var "${PREFIX}NEXT_PUBLIC_SUPABASE_URL")"
ANON="$(get_var "${PREFIX}NEXT_PUBLIC_SUPABASE_ANON_KEY")"
ROLE="$(get_var "${PREFIX}SUPABASE_SERVICE_ROLE_KEY")"
DB="$(get_var "${PREFIX}SUPABASE_DB_URL")"

for v in URL ANON ROLE DB; do
  if [[ -z "${!v}" ]]; then
    echo "Missing ${PREFIX}* value in .env.projects.local"
    exit 1
  fi
done

# Replace the four Supabase lines in .env.local (macOS sed)
sed -i '' "s|^NEXT_PUBLIC_SUPABASE_URL=.*|NEXT_PUBLIC_SUPABASE_URL=${URL}|" "$LOCAL"
sed -i '' "s|^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*|NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}|" "$LOCAL"
sed -i '' "s|^SUPABASE_SERVICE_ROLE_KEY=.*|SUPABASE_SERVICE_ROLE_KEY=${ROLE}|" "$LOCAL"
sed -i '' "s|^SUPABASE_DB_URL=.*|SUPABASE_DB_URL=${DB}|" "$LOCAL"

echo "✅ .env.local Supabase block → ${TARGET} (from .env.projects.local)"
