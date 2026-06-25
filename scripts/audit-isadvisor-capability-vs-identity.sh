#!/usr/bin/env bash
#
# audit-isadvisor-capability-vs-identity.sh
#
# Scopes the "isAdvisor conflates capability and identity" refactor.
# Root cause: getAccessContext sets `isAdvisor: isSuperuser || role === 'advisor'`,
# so a superuser (capability) gets routed through advisor-IDENTITY logic
# (firm billing). Every isAdvisor usage must be classified:
#
#   CAPABILITY (access check)  -> keep; superuser SHOULD pass
#   IDENTITY   (billing model, primary experience, firm linkage)
#                              -> switch to profile.role === 'advisor'
#
# This script finds and contextualizes every call site. It does NOT change code.
# Output is a worksheet you classify by hand — classification is the deliverable.
#
# Usage:
#   bash scripts/audit-isadvisor-capability-vs-identity.sh > ISADVISOR_AUDIT.txt

set -euo pipefail
SRC="${SRC:-app lib middleware.ts components}"   # adjust if paths differ

echo "============================================================"
echo " isAdvisor capability-vs-identity audit"
echo " generated: $(date)"
echo "============================================================"
echo

echo "------------------------------------------------------------"
echo " 0. THE ROOT DEFINITION (where capability and identity merge)"
echo "------------------------------------------------------------"
grep -rn "isAdvisor:" $SRC 2>/dev/null | grep -E "isSuperuser|is_superuser" \
  || echo "  (search lib/auth or getAccessContext manually if not found)"
echo
echo "  ^ This is the conflation point. The refactor splits this into:"
echo "    - isAdvisor (capability: isSuperuser || role==='advisor')  [unchanged, for access]"
echo "    - role==='advisor' used directly for identity branches"
echo

echo "------------------------------------------------------------"
echo " 1. EVERY isAdvisor READ (each needs CAPABILITY vs IDENTITY classification)"
echo "    File:line  + the line. Then read 3 lines of surrounding context below."
echo "------------------------------------------------------------"
grep -rn "isAdvisor" $SRC 2>/dev/null | grep -v "isAdvisor:" || echo "  (none found — check paths)"
echo

echo "------------------------------------------------------------"
echo " 2. CONTEXT for each usage (±3 lines) — to classify access vs identity"
echo "------------------------------------------------------------"
grep -rn --include="*.ts" --include="*.tsx" -C3 "isAdvisor" $SRC 2>/dev/null \
  | grep -v "isAdvisor:" || true
echo

echo "------------------------------------------------------------"
echo " 3. SISTER FLAGS — same conflation likely exists for these"
echo "    isAttorney / isAdmin may also be (isSuperuser || role===...)."
echo "    If so, they have the SAME bug and belong in the same refactor."
echo "------------------------------------------------------------"
grep -rn -E "isAttorney:|isAdmin:" $SRC 2>/dev/null \
  | grep -E "isSuperuser|is_superuser" || echo "  (no superuser-OR found for isAttorney/isAdmin)"
echo
echo "  All isAttorney usages:"
grep -rn "isAttorney" $SRC 2>/dev/null | grep -v "isAttorney:" || echo "  (none)"
echo "  All isAdmin usages:"
grep -rn "isAdmin" $SRC 2>/dev/null | grep -v "isAdmin:" || echo "  (none)"
echo

echo "------------------------------------------------------------"
echo " 4. IDENTITY HOTSPOTS — files where a wrong classification HURTS most"
echo "    (billing model, firm linkage, primary dashboard, role redirects)"
echo "------------------------------------------------------------"
grep -rln -E "isAdvisor|isFirmOwner|firm_id" $SRC 2>/dev/null \
  | grep -E "billing|firm|dashboard|layout|middleware" || echo "  (none matched)"
echo

echo "------------------------------------------------------------"
echo " 5. DIRECT role reads (the CORRECT pattern — where identity is already"
echo "    keyed on role, for comparison/consistency)"
echo "------------------------------------------------------------"
grep -rn -E "role === ['\"]advisor['\"]|profile\.role|\.role ===" $SRC 2>/dev/null \
  | head -40 || true
echo

echo "============================================================"
echo " CLASSIFICATION WORKSHEET (fill in by hand from sections 1-2)"
echo "============================================================"
cat <<'WORKSHEET'

  For each isAdvisor call site, mark one:

  [ ] CAPABILITY  — gates ACCESS (menus, portals, tier ceiling, can-view).
                    Superuser SHOULD pass. KEEP as access.isAdvisor.
  [ ] IDENTITY    — decides billing model / firm linkage / primary experience
                    / role-specific redirect. Superuser should NOT be treated
                    as an advisor here. SWITCH to profile.role === 'advisor'.
  [ ] UNSURE      — flag for review; do not change until classified.

  file:line   classification   note
  ---------   --------------   ----
  (billing/page.tsx ~40)   IDENTITY   firm billing branch — the bug you found
  ...

  SCOPE SIGNAL:
   - Mostly CAPABILITY, few IDENTITY  -> small, bounded refactor, fix now.
   - Many IDENTITY across billing/middleware/RLS -> larger; be deliberate.
   - isAttorney/isAdmin also conflated -> same bug, fold into one refactor.

WORKSHEET

echo "============================================================"
echo " Next: classify every section-1/2 hit, count IDENTITY sites, then"
echo " decide fix-now vs scheduled. The IDENTITY count is the scope."
echo "============================================================"
