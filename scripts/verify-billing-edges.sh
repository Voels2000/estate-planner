#!/usr/bin/env bash
# Pre-flip item 6 — billing edge paths without live charges.
# Runs unit tests for past_due, canceling, canceled, checkout blocks, refund ack.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "Billing edge unit tests (no Stripe charges)..."
npx playwright test \
  tests/unit/consumerSubscriptionStatus.spec.ts \
  tests/unit/resolveEffectiveTier.spec.ts \
  tests/unit/consumerCheckoutBlockReason.spec.ts \
  tests/unit/processConsumerCheckout.spec.ts \
  tests/unit/hasEverSubscribed.spec.ts \
  tests/unit/oneTimePurchases.spec.ts \
  --project=import-unit

echo ""
echo "✅ Billing edge unit gate passed"
echo ""
echo "Optional staging (test mode, no real charges):"
echo "  • Decline card: 4000000000000002 at checkout"
echo "  • Failed renewal: Stripe Dashboard → test webhook invoice.payment_failed"
echo "  • Cancellation: already attested C-4 walkthrough (2026-06-27)"
