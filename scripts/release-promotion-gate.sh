#!/usr/bin/env bash
# Staging → main promotion gate — structural schema check on production.
#
#   npm run release:promotion
#
# Fail closed if production DB is missing schema required by policy-alignment stack
# (#67+). Mirrors assert-rls-coverage pattern — converts "remember to migrate" into
# "cannot promote without schema."
#
# See docs/POLICY_ALIGNMENT_STACK.md · docs/PROMOTION_STAGING_TO_MAIN.md

set -euo pipefail

echo "=== Staging → main promotion gate (production schema) ==="
npm run verify:promotion-schema
echo ""
echo "Promotion gate passed. Proceed with staging→main merge only after counsel sign-off on #60 policy text."
