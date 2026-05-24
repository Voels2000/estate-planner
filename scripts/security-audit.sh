#!/usr/bin/env bash
# Sprint C-3 Phase 1b + Phase 3 — security grep pass
# Run from project root: bash scripts/security-audit.sh

set -euo pipefail

RESULTS="security-audit-results.txt"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
TOTAL=0

fail() {
  echo "FAIL [$1]: $2"
  TOTAL=$((TOTAL + 1))
}

pass() {
  echo "PASS: $1"
}

grep_file() {
  grep -q "$1" "$2" 2>/dev/null
}

echo "# Security Audit — Sprint C-3" > "$RESULTS"
echo "# Run: $TIMESTAMP" >> "$RESULTS"
echo "" >> "$RESULTS"

# Task 1 — auth callback route
if [[ -f app/auth/callback/route.ts ]]; then
  pass "app/auth/callback/route.ts exists"
else
  fail "CRITICAL" "Missing app/auth/callback/route.ts"
fi

# Task 2 — confirm-email page
if [[ -f app/auth/confirm-email/page.tsx ]]; then
  pass "app/auth/confirm-email/page.tsx exists"
else
  fail "CRITICAL" "Missing app/auth/confirm-email/page.tsx"
fi

# Task 3 — signup must not bypass email verification
if grep_file "signInWithPassword" "app/(auth)/signup/_signup-form.tsx"; then
  fail "CRITICAL" "signup form still calls signInWithPassword"
else
  pass "signup form does not call signInWithPassword"
fi

if grep_file "signUp response:" "app/(auth)/signup/_signup-form.tsx"; then
  fail "HIGH" "signup form logs signUp response with user data"
else
  pass "signup form does not log signUp response payload"
fi

if grep_file "/auth/confirm-email" "app/(auth)/signup/_signup-form.tsx"; then
  pass "signup redirects to /auth/confirm-email"
else
  fail "HIGH" "signup form missing redirect to /auth/confirm-email"
fi

# Task 4 — MFA middleware
if grep_file "getAuthenticatorAssuranceLevel" middleware.ts; then
  pass "middleware enforces MFA AAL2 check"
else
  fail "CRITICAL" "middleware missing getAuthenticatorAssuranceLevel"
fi

if grep_file "/mfa-challenge" middleware.ts; then
  pass "middleware redirects to /mfa-challenge"
else
  fail "HIGH" "middleware missing /mfa-challenge redirect"
fi

# Task 5 — PII in Stripe webhook console.log lines only
WEBHOOK=app/api/stripe/webhook/route.ts
if grep "console\." "$WEBHOOK" 2>/dev/null | grep -E "JSON\.stringify|userId:|customer:|customerId|subscription:" >/dev/null 2>&1; then
  fail "HIGH" "Stripe webhook console.* may log PII"
else
  pass "Stripe webhook avoids PII console.log patterns"
fi

# Task 6 — welcome route auth guard
if grep_file "getUser()" app/api/email/welcome/route.ts && grep_file "Unauthorized" app/api/email/welcome/route.ts; then
  pass "welcome email route requires authentication"
else
  fail "CRITICAL" "welcome email route missing auth guard"
fi

# Task 7 — security headers in next.config
if grep_file "Strict-Transport-Security" next.config.ts && grep_file "Content-Security-Policy" next.config.ts; then
  pass "next.config.ts defines security headers"
else
  fail "HIGH" "next.config.ts missing security headers"
fi

# Service role key must not be exposed as a NEXT_PUBLIC env var name
if grep -rE "NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE" . \
  --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' \
  --exclude-dir=node_modules --exclude-dir=.next 2>/dev/null; then
  fail "CRITICAL" "SERVICE_ROLE key exposed via NEXT_PUBLIC env var name"
else
  pass "no NEXT_PUBLIC SERVICE_ROLE exposure"
fi

echo ""
echo "================================"
if [[ "$TOTAL" -eq 0 ]]; then
  echo "✅ Security audit passed — 0 findings"
  exit 0
else
  echo "❌ Security audit failed — $TOTAL finding(s)"
  echo "See $RESULTS for details"
  exit 1
fi
