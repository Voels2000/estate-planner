#!/usr/bin/env bash
# Phase B — copy production schema to mwm-staging and diff for parity.
#
# Reads PROD_SUPABASE_DB_URL + STAGING_SUPABASE_DB_URL from .env.projects.local
# (fallback: SUPABASE_DB_URL from .env.local + STAGING_DB_URL from .env.staging.local).
#
# Usage: bash scripts/two-db-schema-parity.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

load_projects() {
  eval "$(bash scripts/load-env-projects.sh)"
}

if [[ -f .env.projects.local ]]; then
  load_projects
  PROD_DB_URL="${PROD_SUPABASE_DB_URL:-}"
  STAGING_DB_URL="${STAGING_SUPABASE_DB_URL:-}"
fi

if [[ -z "${PROD_DB_URL:-}" && -f .env.local ]]; then
  PROD_DB_URL="$(grep '^SUPABASE_DB_URL=' .env.local | cut -d= -f2- | tr -d '\r')"
fi

if [[ -z "${STAGING_DB_URL:-}" && -f .env.staging.local ]]; then
  STAGING_DB_URL="$(grep '^STAGING_DB_URL=' .env.staging.local | cut -d= -f2- | tr -d '\r')"
fi

if [[ -z "${PROD_DB_URL:-}" || -z "${STAGING_DB_URL:-}" ]]; then
  echo "Need PROD_SUPABASE_DB_URL + STAGING_SUPABASE_DB_URL in .env.projects.local"
  exit 1
fi

STAMP="$(date +%Y%m%d_%H%M%S)"
PROD_DUMP="/tmp/mwm_prod_schema_${STAMP}.sql"
STAGING_DUMP="/tmp/mwm_staging_schema_${STAMP}.sql"

echo "==> Dumping production schema..."
pg_dump "$PROD_DB_URL" --schema-only --no-owner --no-privileges -f "$PROD_DUMP"
echo "    Wrote $PROD_DUMP ($(wc -l < "$PROD_DUMP") lines)"

echo "==> Applying schema to staging (benign duplicate-object errors are OK on empty project)..."
psql "$STAGING_DB_URL" -v ON_ERROR_STOP=0 -f "$PROD_DUMP" 2>&1 | tail -20

echo "==> Dumping staging schema for diff..."
pg_dump "$STAGING_DB_URL" --schema-only --no-owner --no-privileges -f "$STAGING_DUMP"
echo "    Wrote $STAGING_DUMP ($(wc -l < "$STAGING_DUMP") lines)"

echo "==> Diff (prod vs staging) — review output; public schema should match..."
if diff -u "$PROD_DUMP" "$STAGING_DUMP" > "/tmp/mwm_schema_diff_${STAMP}.txt"; then
  echo "✅ Schemas match (no diff)."
else
  LINES="$(wc -l < "/tmp/mwm_schema_diff_${STAMP}.txt")"
  echo "⚠️  Diff has ${LINES} lines — saved to /tmp/mwm_schema_diff_${STAMP}.txt"
  echo "    First 40 lines:"
  head -40 "/tmp/mwm_schema_diff_${STAMP}.txt"
  echo ""
  echo "    Small diffs in extensions/comments are OK; missing tables/functions/RLS are not."
fi

echo ""
echo "Done. Reply to Cursor with: schema parity done (+ any diff summary if non-empty)."
