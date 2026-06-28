#!/usr/bin/env bash
# repro-advisor-empty-serial.sh
# -----------------------------------------------------------------------------
# Highest-fidelity LOCAL read before any fix. Runs the REAL serial isolation spec
# (not a synthetic approximation) N times in ONE worker with the route auth
# diagnostics on, and tallies whether advisor-empty's route call ever returns the
# async-null 401 after the full serial accumulation that precedes it in CI.
#
# Decisive split:
#   401/getSession-null appears  -> serial accumulation alone triggers it.
#                                   #157 (real per-test isolation) is the fix.
#                                   Bisect locally; no CI needed for diagnosis.
#   clean at high N              -> serial depth is NOT sufficient on a quiet box.
#                                   The only remaining variable is runner
#                                   concurrency (parallel jobs / shared load),
#                                   which by definition only CI reproduces.
#                                   Clean here NARROWS, it does not clear.
#
# Usage:
#   ./scripts/repro-advisor-empty-serial.sh            # N=20 repeats of the full file
#   N=50 ./scripts/repro-advisor-empty-serial.sh
#
# With CI tarball auth (after unpack):
#   E2E_REUSE_AUTH=1 E2E_SUITE=security-isolation ./scripts/repro-advisor-empty-serial.sh
# -----------------------------------------------------------------------------
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SPEC="${SPEC:-tests/e2e/security/cross-household-isolation.spec.ts}"
PROJECT="${PROJECT:-security}"
N="${N:-20}"
LOG="/tmp/advisor-empty-repro-$(date +%s).log"

echo "Running real spec: $SPEC  x$N  (1 worker, serial), diagnostics ON"
echo "Project: $PROJECT  E2E_REUSE_AUTH=${E2E_REUSE_AUTH:-<unset>}  E2E_SUITE=${E2E_SUITE:-<unset>}"
echo "Log -> $LOG"
unset STRIPE_SECRET_KEY

REUSE_AUTH="${E2E_REUSE_AUTH:-}"
SUITE="${E2E_SUITE:-}"

ENV_ARGS=(E2E_DIAG_ROUTE_AUTH=1)
if [ -n "$REUSE_AUTH" ]; then ENV_ARGS+=(E2E_REUSE_AUTH="$REUSE_AUTH"); fi
if [ -n "$SUITE" ]; then ENV_ARGS+=(E2E_SUITE="$SUITE"); fi

npx dotenv -o -e .env.test.local -- env "${ENV_ARGS[@]}" \
  npx playwright test "$SPEC" \
    --project="$PROJECT" \
    --workers=1 \
    --repeat-each="$N" \
    2>&1 | tee "$LOG"

echo
echo "================= TALLY ================="
getsess_total=$(grep -c 'client-export-payload-getSession' "$LOG" 2>/dev/null | tr -d '[:space:]' || true)
getsess_total=${getsess_total:-0}
getsess_null=$(grep 'client-export-payload-getSession' "$LOG" 2>/dev/null | grep -c '"sessionPresent":false' | tr -d '[:space:]' || true)
getsess_null=${getsess_null:-0}
post_missing=$(grep 'client-export-payload-auth' "$LOG" 2>/dev/null | grep -c 'Auth session missing' | tr -d '[:space:]' || true)
post_missing=${post_missing:-0}
pre_reads=$(grep -cE 'cookie-layer|cookie-pre' "$LOG" 2>/dev/null | tr -d '[:space:]' || true)
pre_reads=${pre_reads:-0}

echo "route getSession probes:         $getsess_total"
echo "  -> sessionPresent:false:       $getsess_null"
echo "post-getUser 'session missing':  $post_missing"
echo "pre-createClient cookie reads:   $pre_reads"
echo "========================================="
echo

if [ "${getsess_null:-0}" -gt 0 ] || [ "${post_missing:-0}" -gt 0 ]; then
  echo "VERDICT: REPRODUCED locally (serial accumulation is sufficient)."
  echo "  Fix path: #157 — real per-test context isolation instead of the serial"
  echo "  block. This is the structural fix that also retires the tail-victim skip."
  echo "  Grep the log around the failing iteration for the getSession-null line to"
  echo "  confirm: full cookie at pre-read + sessionPresent:false = async storage"
  echo "  read returned null despite the cookie being present."
else
  echo "VERDICT: CLEAN at N=$N (serial depth alone does not trigger it)."
  echo "  This NARROWS to runner concurrency — push the getSession probe to CI and"
  echo "  read the next failing isolation run's triplet (full cookie +"
  echo "  sessionPresent:false + session-missing). Clean here != cleared."
fi
