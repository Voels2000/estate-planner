#!/usr/bin/env bash
# Mint E2E auth for CI prepare: shared link fixture + per-suite sessions for contended roles.
set -euo pipefail

DOTENV=(npx dotenv -o -e .env.test.local --)

echo "Minting shared link-fixture sessions (consumer-link, consumer-pending, advisor-empty, active link)…"
"${DOTENV[@]}" npx playwright test --project=consumer-link-setup --workers=1
"${DOTENV[@]}" npx playwright test --project=consumer-pending-setup --workers=1
"${DOTENV[@]}" npx playwright test --project=advisor-empty-setup --workers=1
"${DOTENV[@]}" npx playwright test --project=consumer-advisor-link-setup --workers=1

mint_suite() {
  local suite="$1"
  export E2E_SUITE="$suite"
  export E2E_MINT_SUITE_AUTH=1
  echo "Minting per-suite sessions for ${suite}…"

  case "$suite" in
    go-live-profile)
      "${DOTENV[@]}" npx playwright test --project=consumer-setup --workers=1
      ;;
    security-smoke|b4-gate|security-isolation)
      "${DOTENV[@]}" npx playwright test --project=consumer-setup --workers=1
      "${DOTENV[@]}" npx playwright test --project=advisor-setup --workers=1
      ;;
    *)
      echo "Unknown suite: $suite" >&2
      exit 1
      ;;
  esac

  unset E2E_MINT_SUITE_AUTH
}

for suite in go-live-profile security-smoke b4-gate security-isolation; do
  mint_suite "$suite"
done

echo "Per-suite auth mint complete."
