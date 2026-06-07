#!/usr/bin/env bash
# Local release gate — run before opening a PR or merging to main.
#
#   npm run release:local              CI parity (lint, build, unit, OpenAPI)
#   npm run release:preflight          + RLS JWT + go-live profile + security E2E
#
# See docs/RELEASE_ROUTINE.md

set -euo pipefail

PREFLIGHT=false
if [[ "${1:-}" == "--preflight" ]]; then
  PREFLIGHT=true
fi

echo "=== Release local gate (CI parity) ==="
npm run lint
npm run build
npm run verify:consumer-openapi
npm run test:unit

if [[ "$PREFLIGHT" == "true" ]]; then
  echo ""
  echo "=== Release preflight (E2E + RLS JWT) ==="
  npm run verify:rls
  npm run test:e2e:go-live-profile -- --workers=1
  npm run test:e2e:security-smoke -- --workers=1
fi

echo ""
echo "Local gate passed."
