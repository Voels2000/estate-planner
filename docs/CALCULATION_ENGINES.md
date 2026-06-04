# Calculation engine registry

Last updated: 2026-06-01 (estate MC engine B)

This document is the **authoritative list** of calculation engines in the codebase.

**Standing rule for every Cursor session:** If the task touches tax, projection,
strategy, or horizon math, start by reading this file. If a function already
exists for what you need, import it — do not reimplement it.

Strategy type/source strings: **`lib/constants/strategyTypes.ts`** — never hardcode
`'cst'` or `'credit_shelter_trust'` at DB query sites.

---

## State estate tax

| Function | File | Use for |
|----------|------|---------|
| `calculateStateEstateTax()` | `lib/calculations/stateEstateTax.ts` | All display surfaces — progressive brackets, portability gap, NY cliff; returns `stateTax`, `stateTaxWithCST`, `cstBenefit` |
| `calculateStateTaxScenarios()` | same | Advisor PDF with/without bypass trust comparison |
| `resolveActiveStateTax()` | same | Pick status-quo vs with-CST amount when `hasBypassTrust` is set |
| `computeStateEstateTaxFromBrackets()` | same | **DEPRECATED** — projection death-year rows only |

**Rule:** Any file that displays a state estate tax dollar amount must import
from `lib/calculations/stateEstateTax.ts`. Hardcoded flat rates are not permitted.

**Trust / CST flag:** Thread `hasBypassTrust` from callers using
`deriveHasBypassTrustFromLineItems()` / `deriveHasBypassTrustFromConfigs()` in
`lib/constants/strategyTypes.ts`.

- **Advisor horizons (actual):** accepted consumer + advisor line items
- **Advisor horizons (projected):** any active CST line item (includes pending advisor rec)
- **Consumer horizons:** accepted line items only (`consumer_accepted = true`)
- **Advisor PDF:** accepted CST line items + `stateBrackets` on `PDFReportData`

---

## Federal estate tax

| Function | File | Use for |
|----------|------|---------|
| `estimateFederalEstateTaxSnapshot()` | `lib/my-estate-strategy/horizonSnapshots.ts` | Horizon snapshot columns |
| `computeEstateTaxProjection()` | `lib/calculations/estate-tax-projection.ts` | Year-by-year projection rows (engine C for state death rows) |
| `currentFederalExemption()` | `lib/export/narrativeEngine.ts` | Display copy only |

---

## State income tax (NOT estate tax)

| Function | File | Use for |
|----------|------|---------|
| `calcStateTax()` | `lib/calculations/projection-complete.ts` | State **income** tax on ordinary income in projection |

---

## Gifting

| Function | File | Use for |
|----------|------|---------|
| `calculate_gifting_summary()` | Supabase RPC | Lifetime used, remaining, annual capacity |

---

## Surfaces and canonical engine (post-unification)

| Surface | State estate tax engine | Trust-aware? |
|---------|-------------------------|--------------|
| PDF cover metric + callout | B via `narrativeEngine` + `stateBrackets` | Yes — `hasBypassTrust` |
| PDF page 3 scenario table | B — `calculateStateTaxScenarios` | Yes — both scenarios |
| Strategy horizons | B via `computeColumnTaxes` | Yes — `hasBypassTrust` threaded |
| Advisor tax tab | B via `StateTaxPanel` | Yes — `stateTaxWithCST` / `cstBenefit` |
| Consumer estate strategy | B via `computeColumnTaxes` | Yes — accepted CST line items |
| Estate tax projection rows | C — `computeStateEstateTaxFromBrackets` | No — future sprint |
| Prospect mode | B via `calculateStateEstateTax` | Yes |
| Estate Monte Carlo (advisor Strategy tab) | B — `calculateStateEstateTax` + `resolveActiveStateTax` per simulated estate | Yes — `hasBypassTrust` |

**Estate MC inputs (POST from Strategy tab):** `stateCode`, `stateBrackets`, `filingStatus`, `hasBypassTrust`. Same `stateBrackets` array as horizon snapshots (today column). Flat `stateEstateTaxRate` removed.

Engine **A** (`narrativeEngine` flat rates) — **deleted**.

---

## How to add a new calculation

1. Read this file first. If the function exists, import it.
2. Add new logic to the appropriate **existing** engine file.
3. Update this registry.
4. Run regression grep checks below before committing.

---

## Regression grep checks (ongoing smoke test)

Run after **every sprint** that touches calculation files.

```bash
# Engine A remnants — must be ZERO
grep -rn "STATE_TAX\b\|getStateTaxInfo\b" \
  lib/ app/ components/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" \
  | grep -v "STATE_HAS_ESTATE_TAX"

# calcStateTax — only projection-complete.ts (state INCOME tax)
grep -rn "calcStateTax" \
  lib/ app/ components/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" \
  | grep -v "projection-complete"

# CST string drift — DB comparison sites must use strategyTypes.ts
grep -rn "credit_shelter_trust\|bypass_trust\|'cst'" \
  lib/ app/ components/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" \
  | grep -v "strategyTypes.ts"
```

On the first grep, ignore `STATE_HAS_ESTATE_TAX` in `stateRegistry.ts` (boolean flags, not engine A).
On the third grep, UI label maps and planning-topic branches are documented exceptions in
[SPRINT_UNIFY_STATE_TAX.md Phase 0](./SPRINT_UNIFY_STATE_TAX.md).
