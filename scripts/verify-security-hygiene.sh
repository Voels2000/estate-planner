#!/usr/bin/env bash
# Pre-flip item 7 — security & measurement hygiene (no live charges).
set -euo pipefail

cd "$(dirname "$0")/.."

REBUILD=false
STAGING_URL="${STAGING_VERIFY_URL:-https://estate-planner-staging.vercel.app}"
PROD_URL="${PROD_VERIFY_URL:-https://www.mywealthmaps.com}"
FAILURES=0

for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=true ;;
  esac
done

fail() {
  echo "❌ $1"
  FAILURES=$((FAILURES + 1))
}

pass() {
  echo "✅ $1"
}

warn() {
  echo "⚠️  $1"
}

echo ""
echo "=== Item 7 — Security & measurement hygiene ==="
echo ""

# 1. Source-level security audit (Sprint C-3)
echo "--- Source audit ---"
if bash scripts/security-audit.sh >/dev/null; then
  pass "security-audit.sh (auth, MFA, headers config, no NEXT_PUBLIC service role)"
else
  fail "security-audit.sh — run bash scripts/security-audit.sh for details"
fi

# 2. Client bundle secret scan
echo ""
echo "--- Client bundle scan ---"
if [[ "$REBUILD" == true ]] || [[ ! -d .next/static/chunks ]]; then
  echo "Building with CI placeholders (no real secrets)..."
  NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
  NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key \
  SUPABASE_SERVICE_ROLE_KEY=placeholder-service-role-key \
  RESEND_API_KEY=re_placeholder_ci_build_only \
  STRIPE_SECRET_KEY=sk_test_placeholder_ci_build_only \
  npm run build >/dev/null
  pass "production build completed (placeholder env)"
fi

CHUNK_DIR=".next/static/chunks"
if [[ ! -d "$CHUNK_DIR" ]]; then
  fail "No $CHUNK_DIR — run with --rebuild or npm run build"
else
  if rg -q 'sk_live_[a-zA-Z0-9]{10,}|whsec_[a-zA-Z0-9]{10,}|re_[a-zA-Z0-9]{20,}' "$CHUNK_DIR" 2>/dev/null; then
    fail "client chunks contain live Stripe/Resend secret values"
  else
    pass "no live secret values (sk_live_/whsec_/re_) in client chunks"
  fi

  if rg -q 'placeholder-service-role-key|sk_test_placeholder_ci_build_only' "$CHUNK_DIR" 2>/dev/null; then
    fail "server-only env values leaked into client chunks"
  else
    pass "build-time server env values not present in client chunks"
  fi

  if rg -q 'SUPABASE_SERVICE_ROLE_KEY|INTERNAL_API_KEY|CRON_SECRET' "$CHUNK_DIR" 2>/dev/null; then
    warn "env var names from manifest appear in client bundle (names only — verify no values)"
  else
    pass "no server env var names in client chunks"
  fi
fi

# 3. Live security headers (prod)
echo ""
echo "--- Security headers (prod) ---"
HEADERS=$(curl -sSI "$PROD_URL/" 2>/dev/null || true)
for H in \
  "strict-transport-security" \
  "x-frame-options" \
  "x-content-type-options" \
  "content-security-policy" \
  "referrer-policy" \
  "permissions-policy"; do
  if echo "$HEADERS" | grep -qi "^${H}:"; then
    pass "prod $H"
  else
    fail "prod missing $H"
  fi
done

# 4. Analytics / funnel instrumentation
echo ""
echo "--- Analytics & funnel ---"
for f in \
  app/layout.tsx \
  app/api/analytics/funnel/route.ts \
  lib/analytics/useFunnelEvent.ts \
  lib/analytics/trackUpgrade.ts; do
  if [[ -f "$f" ]]; then
    pass "present: $f"
  else
    fail "missing: $f"
  fi
done

if grep -q '@vercel/analytics/next' app/layout.tsx && grep -q '<Analytics' app/layout.tsx; then
  pass "Vercel Analytics component in root layout"
else
  fail "Vercel Analytics not wired in app/layout.tsx"
fi

if grep -rq 'captureFunnelEvent' app lib components 2>/dev/null; then
  pass "captureFunnelEvent used in product surfaces"
else
  fail "captureFunnelEvent not found in app code"
fi

# 5. Staging verify-env?live=1 (advisor/attorney test prices)
echo ""
echo "--- Staging verify-env (advisor/attorney prices) ---"
TOKEN=""
for envfile in .env.test.staging .env.test.local; do
  if [[ -f "$envfile" ]]; then
    t=$(grep -E '^ADMIN_VERIFY_TOKEN=' "$envfile" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
    if [[ -n "$t" && "$t" != *"<"* ]]; then
      TOKEN="$t"
      break
    fi
  fi
done

if [[ -z "$TOKEN" ]]; then
  warn "ADMIN_VERIFY_TOKEN not in .env.test.staging — skip live price check"
  echo "   Manual: curl -H \"x-admin-token: \$STAGING_ADMIN_VERIFY_TOKEN\" \\"
  echo "     \"$STAGING_URL/api/admin/verify-env?live=1\""
else
  BODY=$(curl -sS -H "x-admin-token: $TOKEN" "$STAGING_URL/api/admin/verify-env?live=1" || true)
  HTTP=$(curl -sS -o /dev/null -w '%{http_code}' -H "x-admin-token: $TOKEN" "$STAGING_URL/api/admin/verify-env?live=1" || echo "000")
  if [[ "$HTTP" != "200" ]]; then
    fail "staging verify-env HTTP $HTTP (check ADMIN_VERIFY_TOKEN on estate-planner-staging)"
  else
    if echo "$BODY" | python3 -c "
import sys, json
d = json.load(sys.stdin)
boot = d.get('boot') or {}
connection = boot.get('connection_billing_enabled') is True
prices = (d.get('liveness') or {}).get('stripe_prices') or []
if connection:
    adv = [p for p in prices if 'CONNECTION' in p.get('env_var','')]
else:
    adv = [p for p in prices if ('ADVISOR' in p.get('env_var','') or 'ATTORNEY' in p.get('env_var','')) and 'CONNECTION' not in p.get('env_var','')]
bad = [p for p in adv if p.get('status') not in ('active', 'skipped')]
crit = [f for f in d.get('flags',[]) if f.get('level') == 'CRITICAL']
if bad:
    print('BAD_PRICES')
    for p in bad: print(p.get('env_var'), p.get('status'))
    sys.exit(1)
if crit:
    print('CRITICAL_FLAGS')
    sys.exit(1)
mode = (d.get('liveness') or {}).get('stripe_key_mode')
print('ok', len(adv), 'pro prices checked', 'connection='+str(connection), 'mode='+str(mode))
" 2>/dev/null; then
      pass "staging verify-env?live=1 — advisor/attorney prices active (test mode)"
    else
      fail "staging verify-env — advisor/attorney price IDs not all active"
    fi
  fi
fi

echo ""
if [[ "$FAILURES" -eq 0 ]]; then
  echo "✅ Item 7 security hygiene gate passed"
  exit 0
fi

echo "❌ Item 7 failed — $FAILURES check(s)"
exit 1
