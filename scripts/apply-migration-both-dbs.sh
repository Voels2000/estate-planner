#!/usr/bin/env bash
# Apply one migration SQL file to BOTH Supabase projects (staging + production).
#
# Usage:
#   bash scripts/apply-migration-both-dbs.sh supabase/migrations/20260718120000_attorney_drip_unsubscribed_at.sql
#
# Requires .env.projects.local with STAGING_SUPABASE_DB_URL and PROD_SUPABASE_DB_URL
# (session pooler URIs — see .env.projects.example).
#
# Gate: run before merging code that depends on the migration.
# See docs/DEPLOYMENT.md § "Migration gate (both databases)".

set -euo pipefail

MIGRATION="${1:?Usage: $0 supabase/migrations/<timestamp>_name.sql}"

if [[ ! -f "$MIGRATION" ]]; then
  echo "Migration file not found: $MIGRATION" >&2
  exit 1
fi

if [[ ! -f .env.projects.local ]]; then
  echo "Missing .env.projects.local — copy .env.projects.example and fill STAGING_* + PROD_* DB URLs." >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required (PostgreSQL client). Install it, then re-run." >&2
  exit 1
fi

# Load vault without printing secrets
set -a
# shellcheck disable=SC1091
source <(grep -E '^(STAGING|PROD)_SUPABASE_DB_URL=' .env.projects.local)
set +a

: "${STAGING_SUPABASE_DB_URL:?STAGING_SUPABASE_DB_URL unset in .env.projects.local}"
: "${PROD_SUPABASE_DB_URL:?PROD_SUPABASE_DB_URL unset in .env.projects.local}"

apply() {
  local label="$1"
  local url="$2"
  echo "── $label ──"
  psql "$url" -v ON_ERROR_STOP=1 -f "$MIGRATION"
  echo "✓ $label"
}

apply "staging (cmzyxpxfyvdvbsykjvsg)" "$STAGING_SUPABASE_DB_URL"
apply "production (fnzvlmrqwcqwiqueevux)" "$PROD_SUPABASE_DB_URL"

echo ""
echo "Done. Verify schema on both projects before merging dependent app code."
