#!/usr/bin/env bash
# One-time PITR propagation gate — run a few times over 48h after enabling PITR, then retire.
# Exits 0 only when pitr_enabled=true AND recovery window timestamps exist.
#
#   npm run check:pitr-prod
#
# Requires: supabase CLI logged in, or SUPABASE_ACCESS_TOKEN in env.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT_REF="fnzvlmrqwcqwiqueevux"

if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  npx tsx scripts/check-pitr-prod-once.ts
  exit $?
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "NOT YET: install supabase CLI or set SUPABASE_ACCESS_TOKEN" >&2
  exit 1
fi

supabase backups list --project-ref "$PROJECT_REF" -o json \
  | node -e '
const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
const latest = d.physical_backup_data?.latest_physical_backup_date_unix;
const ok = d.pitr_enabled === true && latest != null && latest > 0;
if (ok) {
  console.log("PITR LIVE: window present");
  console.log("  latest:", new Date(latest * 1000).toISOString());
  const earliest = d.physical_backup_data?.earliest_physical_backup_date_unix;
  if (earliest) console.log("  earliest:", new Date(earliest * 1000).toISOString());
  process.exit(0);
}
console.log("NOT YET: pitr_enabled=" + d.pitr_enabled + (latest ? "" : " (no latest timestamp)"));
process.exit(1);
'
