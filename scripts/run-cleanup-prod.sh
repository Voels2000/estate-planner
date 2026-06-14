#!/usr/bin/env bash
# Run cleanup-test-accounts.ts against PRODUCTION (loads PROD_* from .env.projects.local).
# Usage:
#   bash scripts/run-cleanup-prod.sh --purge-unprotected           # dry-run (default)
#   bash scripts/run-cleanup-prod.sh --purge-unprotected --yes --force  # execute

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.projects.local ]]; then
  echo "Missing .env.projects.local"
  exit 1
fi

export NEXT_PUBLIC_SUPABASE_URL="$(grep '^PROD_NEXT_PUBLIC_SUPABASE_URL=' .env.projects.local | cut -d= -f2- | tr -d '\r')"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$(grep '^PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.projects.local | cut -d= -f2- | tr -d '\r')"
export SUPABASE_SERVICE_ROLE_KEY="$(grep '^PROD_SUPABASE_SERVICE_ROLE_KEY=' .env.projects.local | cut -d= -f2- | tr -d '\r')"

exec npx tsx scripts/cleanup-test-accounts.ts "$@"
