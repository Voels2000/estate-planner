#!/usr/bin/env bash
# collect-migration-ledger-info.sh
# -----------------------------------------------------------------------------
# Read-only. Gathers what's needed to (a) patch apply-migration.sh so it records
# the ledger, and (b) compute the exact set of migrations to mark applied.
#
# SAFETY:
#   - SELECT-only. No writes, no migrations applied.
#   - NEVER prints a connection string / secret. xtrace stays OFF.
#   - Sections 1-3 are pure local (no DB, no creds). Run them anywhere.
#   - Section 4 (DB) only runs if you pass a one-shot DB_URL. See usage.
#
# USAGE:
#   # local-only (no creds): just shows the script + repo + CLI state
#   ./collect-migration-ledger-info.sh production
#
#   # with DB read (one-shot var, NOT exported, so it doesn't linger in your shell):
#   DB_URL='postgresql://...prod...' ./collect-migration-ledger-info.sh production
#   DB_URL='postgresql://...staging...' ./collect-migration-ledger-info.sh staging
#
#   Grab the per-env URL from wherever apply-migration.sh sources it (Section 1
#   will show you). If your Supabase CLI is linked, you can skip DB_URL entirely
#   and run `supabase migration list` per env instead — no raw creds needed.
# -----------------------------------------------------------------------------
set -uo pipefail   # NOT -e: a missing tool in one section shouldn't abort the rest
set +x             # never trace — keeps any URL out of the output

ENV_LABEL="${1:-unspecified}"
say()  { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
note() { printf '   %s\n' "$1"; }

printf '\033[1mMigration ledger info — env label: %s\033[0m\n' "$ENV_LABEL"
note "(label is for your output only; it does not select a database)"

# -----------------------------------------------------------------------------
say "1. apply-migration.sh — how it connects (this is what I need to patch it)"
FOUND=""
for p in scripts/apply-migration.sh ./apply-migration.sh bin/apply-migration.sh; do
  if [ -f "$p" ]; then FOUND="$p"; break; fi
done
if [ -n "$FOUND" ]; then
  echo "--- $FOUND ---"
  cat "$FOUND"
else
  echo "apply-migration.sh not found in common paths. Locate it:"
  ( command -v rg >/dev/null && rg --files | grep -i 'apply-migration' ) \
    || find . -name 'apply-migration*.sh' -not -path '*/node_modules/*' 2>/dev/null \
    || echo "  (search failed — cat the file manually)"
fi
echo
note "Also showing any sibling DB helper scripts for connection patterns:"
ls -1 scripts/ 2>/dev/null | grep -iE 'migrat|supabase|seed|db' || true

# -----------------------------------------------------------------------------
say "2. Supabase CLI availability + project linkage (decides repair vs raw SQL)"
if command -v supabase >/dev/null 2>&1; then
  supabase --version 2>/dev/null || true
  echo "config.toml:"; [ -f supabase/config.toml ] && grep -E '^\s*(project_id|\[)' supabase/config.toml | head -20 || echo "  (none)"
  echo "linked project ref (if any):"
  [ -f supabase/.temp/project-ref ] && cat supabase/.temp/project-ref || echo "  (not linked / unknown)"
else
  echo "supabase CLI not on PATH — we'll use the raw-SQL backfill path instead."
fi

# -----------------------------------------------------------------------------
say "3. Repo migration files (the source of truth for what SHOULD be applied)"
MDIR="supabase/migrations"
if [ -d "$MDIR" ]; then
  COUNT=$(ls -1 "$MDIR"/*.sql 2>/dev/null | wc -l | tr -d ' ')
  echo "files: $COUNT"
  # version = leading timestamp of each filename
  ls -1 "$MDIR"/*.sql 2>/dev/null | xargs -n1 basename | sed -E 's/^([0-9]+)_.*/\1/' \
    | grep -E '^[0-9]+$' | sort -u > /tmp/repo_versions.txt
  echo "versions written to /tmp/repo_versions.txt (first/last):"
  head -1 /tmp/repo_versions.txt; echo "..."; tail -1 /tmp/repo_versions.txt
else
  echo "no $MDIR directory found — adjust path."
fi

# -----------------------------------------------------------------------------
say "4. Ledger state on THIS env (read-only) + diff vs repo"
if [ -z "${DB_URL:-}" ]; then
  note "DB_URL not set — skipping the DB read."
  note "Either re-run with:  DB_URL='postgresql://...' $0 $ENV_LABEL"
  note "or, if the CLI is linked to this env, run:  supabase migration list"
else
  note "Using DB_URL from environment (value is NOT printed)."
  note "Note: a URL passed to psql can briefly appear in 'ps'. If that matters on"
  note "prod, use the 'supabase migration list' path instead."

  # 4a. table shape (only matters if we fall back to raw-SQL backfill)
  echo "--- schema_migrations columns ---"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -At -F$'\t' -c \
    "select column_name, data_type
       from information_schema.columns
      where table_schema='supabase_migrations'
        and table_name='schema_migrations'
      order by ordinal_position;" 2>&1 || echo "(query failed — check DB_URL / access)"

  # 4b. count + sample rows
  echo "--- row count ---"
  psql "$DB_URL" -At -c \
    "select count(*) from supabase_migrations.schema_migrations;" 2>&1 || true
  echo "--- newest 5 rows (version, name if present) ---"
  psql "$DB_URL" -At -F$'\t' -c \
    "select version, coalesce(name,'') from supabase_migrations.schema_migrations
      order by version desc limit 5;" 2>&1 || true

  # 4c. all applied versions -> diff against repo
  psql "$DB_URL" -At -c \
    "select version from supabase_migrations.schema_migrations order by version;" \
    > /tmp/ledger_versions.txt 2>/dev/null || true

  echo "--- MISSING from ledger (in repo, not recorded) = the repair set ---"
  if [ -f /tmp/repo_versions.txt ] && [ -f /tmp/ledger_versions.txt ]; then
    comm -23 /tmp/repo_versions.txt /tmp/ledger_versions.txt
    echo "--- (sanity) recorded but NOT in repo, if any ---"
    comm -13 /tmp/repo_versions.txt /tmp/ledger_versions.txt
  else
    echo "(need both /tmp/repo_versions.txt and a successful DB read)"
  fi
fi

say "Done"
note "Paste back: Section 1 (the script), Section 2 (CLI/linkage), and the"
note "Section 4 'MISSING' list for each env you ran. That's everything I need."
