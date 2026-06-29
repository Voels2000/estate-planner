#!/usr/bin/env bash
# One-shot, READ-ONLY post-deploy attestation against PRODUCTION.
#
# - Resolves prod Supabase vars from .env.projects.local (vault)
# - HARD-FAILS if resolved ref != fnzvlmrqwcqwiqueevux
# - Does NOT read or write .env.local
# - No remediate, migrate, or seed
#
#   npm run release:post-deploy:prod-once
#
# For staging local dev, use .env.local (restore: cp .env.local.off .env.local).
# Do NOT use sync-env-from-projects.sh prod for attestation — use this script instead.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPECTED_PROD_REF="fnzvlmrqwcqwiqueevux"
VAULT="${RELEASE_POST_DEPLOY_VAULT:-.env.projects.local}"

if [[ ! -f "$VAULT" ]]; then
  echo "FATAL: $VAULT not found. Cannot resolve prod credentials." >&2
  exit 1
fi

read_vault_var() {
  npx dotenv -o -e "$VAULT" -- node -e "process.stdout.write(process.env.$1||'')"
}

PROD_URL="$(read_vault_var PROD_NEXT_PUBLIC_SUPABASE_URL)"
PROD_ANON="$(read_vault_var PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY)"
PROD_SERVICE="$(read_vault_var PROD_SUPABASE_SERVICE_ROLE_KEY)"
PROD_DB="$(read_vault_var PROD_SUPABASE_DB_URL)"

RESOLVED_REF="$(echo "$PROD_URL" | sed -E 's#https://([^.]+)\.supabase\.co.*#\1#')"

echo "Post-deploy attestation target ref: ${RESOLVED_REF:-<empty>}"

if [[ -z "$RESOLVED_REF" ]]; then
  echo "FATAL: could not resolve a Supabase ref from PROD_NEXT_PUBLIC_SUPABASE_URL." >&2
  echo "       Check $VAULT has PROD_NEXT_PUBLIC_SUPABASE_URL set." >&2
  exit 1
fi

if [[ "$RESOLVED_REF" != "$EXPECTED_PROD_REF" ]]; then
  echo "FATAL: ref guard tripped." >&2
  echo "       expected: $EXPECTED_PROD_REF" >&2
  echo "       resolved: $RESOLVED_REF" >&2
  echo "       Refusing to run attestation against a non-prod database." >&2
  exit 1
fi

if [[ "$PROD_DB" != *"$EXPECTED_PROD_REF"* ]]; then
  echo "FATAL: PROD_SUPABASE_DB_URL does not contain $EXPECTED_PROD_REF." >&2
  echo "       URL ref and DB ref disagree — aborting." >&2
  exit 1
fi

if [[ -z "$PROD_ANON" || -z "$PROD_SERVICE" || -z "$PROD_DB" ]]; then
  echo "FATAL: missing PROD_* Supabase credentials in $VAULT." >&2
  echo "       Need PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY, PROD_SUPABASE_SERVICE_ROLE_KEY, PROD_SUPABASE_DB_URL." >&2
  exit 1
fi

echo "Ref guard passed ($EXPECTED_PROD_REF). Running read-only attestation..."

export NEXT_PUBLIC_SUPABASE_URL="$PROD_URL"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$PROD_ANON"
export SUPABASE_SERVICE_ROLE_KEY="$PROD_SERVICE"
export SUPABASE_DB_URL="$PROD_DB"
export PLAYWRIGHT_BASE_URL="${PLAYWRIGHT_BASE_URL:-https://www.mywealthmaps.com}"

npx tsx scripts/verify-post-deploy-voels.ts
# SQL invariants + structural coverage only on prod.
# JWT behavioral matrix needs staging seed:e2e identities — covered by test:e2e:prod:smoke instead.
npx tsx scripts/verify-rls-post-migration.ts -- --require-sql --skip-behavioral

echo "Post-deploy attestation complete against $EXPECTED_PROD_REF (read-only)."
