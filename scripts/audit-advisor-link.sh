#!/usr/bin/env bash
# audit-advisor-link.sh
# -----------------------------------------------------------------------------
# READ-ONLY. Surfaces the REAL advisor<->consumer linkage path so the test
# connection can be seeded through the product's actual consent/link flow —
# NOT a raw grant. This is the #107 landmine: a link created the wrong way
# re-grants broad access and breaks cross-household isolation (403/404 -> 200).
#
# Sections 1-3 are local (no creds). Section 4 needs a one-shot DB_URL.
#   ./scripts/audit-advisor-link.sh
#   DB_URL='postgresql://...staging...' ./scripts/audit-advisor-link.sh
# Never echoes DB_URL. xtrace stays off.
# -----------------------------------------------------------------------------
set -uo pipefail
set +x
say(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
show(){ [ -f "$1" ] && { echo "--- $1 ---"; cat "$1"; } || echo "MISSING (confirm path): $1"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say "1. Access-context + linkage logic (the code that decides what an advisor sees)"
show "lib/access/getAccessContext.ts" 2>/dev/null || true
grep -rln --include='*.ts' 'getAccessContext' . | grep -v node_modules || true
echo
echo ">> linkage / invite / grant symbols:"
grep -rn --include='*.ts' --include='*.tsx' -i \
  -e 'advisor.*link' -e 'link.*advisor' -e 'inviteAdvisor' -e 'acceptInvite' \
  -e 'advisor_household' -e 'household_advisor' -e 'advisor_consumer' \
  -e 'grantAdvisor' -e 'advisorAccess' \
  . | grep -v node_modules | head -60 || echo "(none found — widen terms)"

say "2. The product's real link-creation flow (mirror THIS in the seed)"
echo ">> server actions / routes that create an advisor-consumer link:"
grep -rln --include='*.ts' --include='*.tsx' -i \
  -e 'advisor' . | grep -viE 'node_modules|\.test\.|\.spec\.' \
  | grep -iE 'action|route|invite|link|connect' || true

say "3. How the CURRENT advisor seed links (and how #107 was fixed)"
for p in scripts/seed-e2e-lib.ts scripts/seed-e2e.ts scripts/seed-advisor*.ts; do
  [ -f "$p" ] && { echo "--- $p (advisor/link lines) ---"; grep -n -i \
     -e 'advisor' -e 'link' -e 'household' -e 'grant' -e 'isolation' "$p" || true; }
done
echo
echo ">> NOTE: the existing advisor seed is likely the UNLINKED isolation fixture."
echo ">> The new pair must be a SEPARATE linked consumer, leaving isolation intact."

say "4. DB: link table shape + RLS that gates advisor access (read-only)"
if [ -z "${DB_URL:-}" ]; then
  echo "DB_URL not set — skipping DB read. Re-run with DB_URL='...' for sections 4a-4d."
else
  echo "(DB_URL used but never printed)"
  echo "--- 4a. candidate linkage tables ---"
  psql "$DB_URL" -At -F$'\t' -c \
    "select table_name from information_schema.tables
      where table_schema='public'
        and table_name ~* '(advisor|link|invite|grant|consent|household)'
      order by 1;" 2>&1 || true
  echo "--- 4b. columns of the link table (fill in real name from 4a) ---"
  echo "    e.g. \\d+ advisor_clients   — run manually once you see 4a"
  echo "--- 4c. RLS policies that reference advisor access (the isolation guards) ---"
  psql "$DB_URL" -At -F$'\t' -c \
    "select schemaname, tablename, policyname, cmd
       from pg_policies
      where qual ilike '%advisor%' or qual ilike '%link%' or with_check ilike '%advisor%'
      order by tablename, policyname;" 2>&1 || true
  echo "--- 4d. existing advisor links today (baseline) ---"
  echo "    Run a SELECT against the link table from 4a to see current links."
fi

say "Done"
echo "Paste back sections 1-3 and 4a/4c. Then write the seed that links a"
echo "NEW dedicated consumer to an advisor via the real flow, with an isolation"
echo "assertion that every OTHER household still returns 403/404."
