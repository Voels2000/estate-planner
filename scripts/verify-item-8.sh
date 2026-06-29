#!/usr/bin/env bash
# Pre-flip item 8 — engineering follow-ups (automated gates).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Item 8 — engineering follow-ups"
echo ""

echo "→ WA Regime D unit tests (19.5% band / \$1.49M @ \$9M taxable)..."
npx playwright test tests/unit/waRegime.spec.ts --project=import-unit

echo ""
echo "→ Estate MC MFJ alignment unit tests..."
npx playwright test tests/unit/estateMcMfj.spec.ts --project=import-unit

echo ""
echo "✅ Item 8 automated gates passed"
echo ""
echo "Manual / optional (not in this script):"
echo "  • Vercel NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY rename — optional housekeeping"
echo "  • B3b — confirm latest staging→main promote if branches diverged"
