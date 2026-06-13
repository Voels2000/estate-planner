#!/usr/bin/env bash
# Stop local E2E load and recover staging Supabase after overload.
#
# Usage:
#   bash scripts/recover-staging-e2e-load.sh          # stop processes + instructions
#   bash scripts/recover-staging-e2e-load.sh --prune  # also run npm run prune:e2e when DB responds
#
set -euo pipefail

PRUNE=false
[[ "${1:-}" == "--prune" ]] && PRUNE=true

echo "=== E2E staging recovery ==="
echo ""

echo "1) Stopping local processes that hammer Supabase..."
for pattern in "release:preflight" "playwright test" "next start" "next dev" "verify-rls"; do
  pkill -f "$pattern" 2>/dev/null && echo "   stopped: $pattern" || true
done
pkill -f "launch-tracker-server" 2>/dev/null || true

echo ""
echo "2) Wait 5–15 minutes for Supabase connection pool to drain."
echo "   Dashboard: Project → Database → Query performance (cancel long queries if any)."
echo "   If still wedged: Project Settings → pause project → resume (last resort)."
echo ""

echo "3) When SQL Editor responds, run blocks in:"
echo "   scripts/recover-staging-e2e-load.sql"
echo ""

echo "4) Prevention (add to .env.local if you run npm run dev during E2E):"
echo "   E2E_SKIP_RECOMPUTE=true"
echo "   (.env.test already has this for Playwright webServer)"
echo ""

echo "5) After DB recovers:"
echo "   npm run prune:e2e"
echo "   npm run seed:e2e          # optional refresh"
echo "   npm run verify:rls"
echo "   npm run test:e2e:go-live-profile -- --workers=1"
echo ""

if $PRUNE; then
  echo "6) Running prune:e2e (60s timeout)..."
  if perl -e 'alarm 60; exec @ARGV' npm run prune:e2e; then
    echo "   prune:e2e OK"
  else
    echo "   prune:e2e timed out — use SQL script in Dashboard instead"
    exit 1
  fi
fi

echo "Done."
