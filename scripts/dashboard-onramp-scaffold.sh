#!/usr/bin/env bash
# ============================================================
# dashboard-onramp-scaffold.sh
#
# Scaffolds the dashboard onramp feature into the correct
# locations in the Estate project.
#
# Run from project root:
#   bash scripts/dashboard-onramp-scaffold.sh
#
# What it does:
#   1. Creates lib/dashboard/onrampGate.ts
#   2. Creates components/dashboard/DashboardOnramp.tsx
#   3. Prints integration notes for app/(dashboard)/dashboard/page.tsx
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(pwd)"
DASHBOARD_PAGE="$PROJECT_ROOT/app/(dashboard)/dashboard/page.tsx"
GATE_FILE="$PROJECT_ROOT/lib/dashboard/onrampGate.ts"
COMPONENT_FILE="$PROJECT_ROOT/components/dashboard/DashboardOnramp.tsx"

echo "🏗  Dashboard onramp scaffold"
echo "   Project root: $PROJECT_ROOT"
echo ""

if [[ ! -f "package.json" ]]; then
  echo "❌  Run this from the project root (where package.json lives)"
  exit 1
fi

if [[ ! -f "$DASHBOARD_PAGE" ]]; then
  echo "❌  Could not find app/(dashboard)/dashboard/page.tsx at expected path"
  echo "   Expected: $DASHBOARD_PAGE"
  exit 1
fi

echo "✓  Found dashboard page at app/(dashboard)/dashboard/page.tsx"

if [[ -f "$GATE_FILE" ]]; then
  echo "⚠️   $GATE_FILE already exists — skipping"
else
  echo "   Run git checkout or delete to regenerate"
fi

if [[ -f "$COMPONENT_FILE" ]]; then
  echo "⚠️   $COMPONENT_FILE already exists — skipping"
else
  echo "   Run git checkout or delete to regenerate"
fi

if grep -q "shouldShowOnramp" "$DASHBOARD_PAGE"; then
  echo "✓  Dashboard page already wired with shouldShowOnramp"
else
  echo ""
  echo "📋  Wire app/(dashboard)/dashboard/page.tsx — see lib/dashboard/onrampGate.ts"
fi

echo ""
echo "✅  Checklist:"
echo "  [ ] npm run build"
echo "  [ ] New user with no data → onramp on /dashboard"
echo "  [ ] Golden path user (wizard done, score ≥60, has data) → full dashboard"
