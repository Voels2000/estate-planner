#!/usr/bin/env bash
# Apply one migration SQL file to a single Supabase project (staging OR production).
#
# Usage:
#   bash scripts/apply-migration.sh staging supabase/migrations/20260718120000_attorney_drip_unsubscribed_at.sql
#   bash scripts/apply-migration.sh production supabase/migrations/20260718120000_attorney_drip_unsubscribed_at.sql
#
# Rule: apply in the environment you're about to deploy code to — schema just before
# the app that depends on it. Do NOT apply production migrations while code is still
# staging-only. See docs/DEPLOYMENT.md § "Migration gate (per environment)".

set -euo pipefail

ENV="${1:?Usage: $0 staging|production supabase/migrations/<timestamp>_name.sql}"
MIGRATION="${2:?Usage: $0 staging|production supabase/migrations/<timestamp>_name.sql}"

if [[ ! -f "$MIGRATION" ]]; then
  echo "Migration file not found: $MIGRATION" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required (PostgreSQL client). Install it, then re-run." >&2
  exit 1
fi

case "$ENV" in
  staging)
    REF="cmzyxpxfyvdvbsykjvsg"
    if [[ -f .env.local ]]; then
      set -a
      # shellcheck disable=SC1091
      source <(grep -E '^SUPABASE_DB_URL=' .env.local 2>/dev/null || true)
      set +a
      DB_URL="${SUPABASE_DB_URL:-}"
    fi
    if [[ -z "${DB_URL:-}" && -f .env.projects.local ]]; then
      set -a
      # shellcheck disable=SC1091
      source <(grep -E '^STAGING_SUPABASE_DB_URL=' .env.projects.local)
      set +a
      DB_URL="${STAGING_SUPABASE_DB_URL:-}"
    fi
    ;;
  production)
    REF="fnzvlmrqwcqwiqueevux"
    if [[ ! -f .env.projects.local ]]; then
      echo "Missing .env.projects.local — PROD_SUPABASE_DB_URL required for production." >&2
      exit 1
    fi
    set -a
    # shellcheck disable=SC1091
    source <(grep -E '^PROD_SUPABASE_DB_URL=' .env.projects.local)
    set +a
    DB_URL="${PROD_SUPABASE_DB_URL:-}"
    ;;
  *)
    echo "Environment must be staging or production (got: $ENV)" >&2
    exit 1
    ;;
esac

: "${DB_URL:?Database URL unset — set SUPABASE_DB_URL in .env.local (staging) or PROD_SUPABASE_DB_URL in .env.projects.local (production)}"

echo "── $ENV ($REF) ──"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION"
echo "✓ $ENV"
echo ""
echo "Verify schema, then deploy (or merge) code that depends on this migration in $ENV only."
