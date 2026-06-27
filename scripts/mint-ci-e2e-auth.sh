#!/usr/bin/env bash
# Mint E2E auth for CI prepare: shared link fixture + per-suite sessions for contended roles.
set -euo pipefail

DOTENV=(npx dotenv -o -e .env.test.local --)

echo "Minting shared link-fixture sessions (consumer-link, consumer-pending, advisor-empty, active link)…"
"${DOTENV[@]}" npx playwright test --project=consumer-link-setup --workers=1
"${DOTENV[@]}" npx playwright test --project=consumer-pending-setup --workers=1
"${DOTENV[@]}" npx playwright test --project=advisor-empty-setup --workers=1
"${DOTENV[@]}" npx playwright test --project=consumer-advisor-link-setup --workers=1

echo "Minting per-suite sessions (independent API sessions — no refresh-token rotation)…"
"${DOTENV[@]}" npx tsx scripts/mint-ci-e2e-auth-sessions.ts

echo "Per-suite auth mint complete."
