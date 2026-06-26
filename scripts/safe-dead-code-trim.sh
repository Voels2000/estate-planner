#!/usr/bin/env bash
# safe-dead-code-trim.sh
# -----------------------------------------------------------------------------
# Verifies the audit's "zero callers" claims against the CURRENT tree before
# removing anything. Don't trust the audit doc blindly — confirm, then cut.
#
#   ./scripts/safe-dead-code-trim.sh            # DRY-RUN: report only
#   ./scripts/safe-dead-code-trim.sh --apply    # git rm confirmed zero-ref whole files
#
# Whole-file deletes only with --apply. Symbol-level exports are REPORTED —
# remove via reviewed edit, not sed.
# -----------------------------------------------------------------------------
set -uo pipefail
APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
EXCL='node_modules|\.next|dist|build'

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

refs(){ # $1 = pattern, $2 = file to exclude from its own count
  grep -rn --include='*.ts' --include='*.tsx' --include='*.js' -e "$1" . \
    | grep -vE "$EXCL" | { [ -n "${2:-}" ] && grep -v "$2" || cat; }
}

say(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

say "Whole-file scripts (safe to git rm if zero references)"
for f in scripts/dashboard-onramp-scaffold.sh scripts/test-engines.ts; do
  [ -f "$f" ] || { echo "skip (absent): $f"; continue; }
  base="$(basename "$f")"
  hits="$(grep -rn -e "$base" . | grep -vE "$EXCL" | grep -v "$f" || true)"
  if [ -z "$hits" ]; then
    if [ "$APPLY" -eq 1 ]; then git rm "$f" && echo "REMOVED: $f";
    else echo "WOULD REMOVE (0 refs): $f"; fi
  else
    echo "KEEP — $f still referenced:"; echo "$hits"
  fi
done

say "Symbol-level exports (REPORT ONLY — remove via reviewed edit if count is 0)"
report_symbol(){ # $1 symbol, $2 defining file
  local c; c="$(refs "$1" "$2" | wc -l | tr -d ' ')"
  printf '  %-40s callers=%s  (def: %s)\n' "$1" "$c" "$2"
  [ "$c" != "0" ] && refs "$1" "$2" | sed 's/^/      /'
}
report_symbol ensureMinEstateHealthScore     scripts/seed-e2e-lib.ts
report_symbol userHasCompletedPlanAndExport  lib/billing/oneTimePurchases.ts
report_symbol createDigitalAsset             app/actions/beneficiary-grant-actions.ts
report_symbol LegalFooterNote                components/legal/LegalDocumentLayout.tsx

say "components/ui/form.ts — unused exports (manual)"
echo "  Knip flagged 7 of 11 unused. List exports, then grep each before trimming:"
grep -nE 'export (const|function|type|interface) ' components/ui/form.ts 2>/dev/null || echo "  (confirm path)"

say "Done"
[ "$APPLY" -eq 0 ] && echo "Dry-run only. Re-run with --apply to git rm the confirmed whole files."
echo "After --apply: npm run verify  (catch any dynamic reference the grep missed)."
