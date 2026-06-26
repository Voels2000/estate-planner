#!/usr/bin/env bash
# preflip-checks.sh
# -----------------------------------------------------------------------------
# READ-ONLY pre-flip verification. Confirms the things the audit flagged as
# "done in code, attest before flip." No writes, no deploys.
#
#   ./scripts/preflip-checks.sh                                  # local-only sections
#   DB_URL='postgresql://...prod...' ./scripts/preflip-checks.sh # adds DB checks
# Never echoes DB_URL.
# -----------------------------------------------------------------------------
set -uo pipefail
set +x
say(){ printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

say "1. Ledger drift (reuses the committed collector)"
if [ -f scripts/collect-migration-ledger-info.sh ]; then
  if [ -n "${DB_URL:-}" ]; then
    bash scripts/collect-migration-ledger-info.sh production | sed -n '/MISSING/,$p' || true
  else
    echo "Set DB_URL to run the drift check, or run the collector per env yourself."
  fi
else
  echo "collector script not found at scripts/collect-migration-ledger-info.sh"
fi

say "2. handle_new_user trigger (proves fresh signups create a profile)"
if [ -n "${DB_URL:-}" ]; then
  echo "--- function present? ---"
  psql "$DB_URL" -At -c \
    "select proname from pg_proc where proname='handle_new_user';" 2>&1 || true
  echo "--- trigger on auth.users? ---"
  psql "$DB_URL" -At -F$'\t' -c \
    "select tgname from pg_trigger
      where tgrelid='auth.users'::regclass and not tgisinternal;" 2>&1 || true
  echo "--- last 5 signups: did each get a profile row? ---"
  psql "$DB_URL" -At -F$'\t' -c \
    "select u.created_at, (p.id is not null) as has_profile
       from auth.users u
       left join profiles p on p.id = u.id
      order by u.created_at desc limit 5;" 2>&1 || true
else
  echo "DB_URL not set — skipping."
fi

say "3. Prod smoke projects (which would run under TEST_ENV=production?)"
PWCFG=""
for p in playwright.config.ts e2e/playwright.config.ts tests/playwright.config.ts; do
  [ -f "$p" ] && { PWCFG="$p"; break; }
done
if [ -n "$PWCFG" ]; then
  echo "--- $PWCFG: project names + TEST_ENV handling ---"
  grep -n -E "name:|TEST_ENV|PROD_SMOKE|projects|testMatch|advisor" "$PWCFG" || true
else
  echo "playwright.config.ts not found in common paths."
fi

say "4. Reminders (manual)"
echo " - Re-run: npm run release:post-deploy   (cutover step 4, post #144/#145)"
echo " - Re-run this script against staging too if you want both envs attested."
say "Done"
