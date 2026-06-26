#!/usr/bin/env bash
# generate-ledger-backfill.sh
# -----------------------------------------------------------------------------
# Generates an idempotent SQL backfill for supabase_migrations.schema_migrations
# from the migration files on disk.
#
#   - Records version + name ONLY. Applies NO schema. Runs nothing destructive.
#   - ON CONFLICT (version) DO NOTHING → safe to apply to any env:
#       prod (128 present) inserts only the 8 missing; staging (0) inserts all 136.
#   - Files whose leading token isn't a timestamp (e.g. VERIFY_session27_*.sql)
#     are skipped automatically — that's the collector's choke handled here.
#
# USAGE:
#   ./scripts/generate-ledger-backfill.sh                       # reads supabase/migrations
#   ./scripts/generate-ledger-backfill.sh path/to/migrations out.sql
# -----------------------------------------------------------------------------
set -euo pipefail

MDIR="${1:-supabase/migrations}"
OUT="${2:-ledger-backfill.sql}"
[ -d "$MDIR" ] || { echo "migrations dir not found: $MDIR" >&2; exit 1; }

n=0; skipped=0
{
  echo "-- Ledger backfill: records applied migrations in the history table."
  echo "-- version + name only. NO schema change. Idempotent (ON CONFLICT DO NOTHING)."
  echo "-- Generated $(date -u +%Y-%m-%dT%H:%M:%SZ) from $MDIR"
  echo "BEGIN;"
  echo "INSERT INTO supabase_migrations.schema_migrations (version, name) VALUES"
  first=1
  for f in "$MDIR"/*.sql; do
    base="$(basename "$f")"
    version="${base%%_*}"
    if ! [[ "$version" =~ ^[0-9]+$ ]]; then
      echo "  -- skipped non-migration: $base" >&2
      skipped=$((skipped+1)); continue
    fi
    rest="${base#*_}"; name="${rest%.sql}"
    name="${name//\'/\'\'}"                       # SQL-escape any single quote
    if [ "$first" -eq 1 ]; then sep="  "; first=0; else sep=" ,"; fi
    printf "%s('%s','%s')\n" "$sep" "$version" "$name"
    n=$((n+1))
  done
  echo "ON CONFLICT (version) DO NOTHING;"
  echo "COMMIT;"
} > "$OUT"

echo "Wrote $OUT — $n migration rows (skipped $skipped non-migration file(s))." >&2
echo "Apply read-first to STAGING, verify, then PROD. No schema is touched." >&2
