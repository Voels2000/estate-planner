#!/usr/bin/env bash
# Production post-deploy verification — run from your machine after Vercel Production deploys.
# Requires prod credentials in .env.local (including SUPABASE_DB_URL for SQL invariants).
#
#   npm run release:post-deploy
#
# See docs/RELEASE_ROUTINE.md

set -euo pipefail

echo "=== Post-deploy production verification ==="
npm run verify:post-deploy-voels
npm run verify:rls -- --require-sql

echo ""
echo "Post-deploy gate passed."
echo ""
echo "Optional prod browser smoke (manual):"
echo "  PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com npm run test:e2e:security-smoke -- --workers=1"
