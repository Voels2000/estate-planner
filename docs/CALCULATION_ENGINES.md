# Calculation engine registry

Last updated: 2026-06-06 (export federal → bracket engine)

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

**Modeled states:** **`MODELED_ESTATE_TAX_STATES`** in `stateEstateTax.ts` — CT, DC, HI, IL, MA, MD, ME, MN, NY, OR, RI, VT, WA (brackets in **`state_estate_tax_rules`**). **`stateHasEstateTax()`** / **`StateTaxPanel`** use this list — not a WA-only path.

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
| `estimateFederalEstateTaxSnapshot()` | `lib/my-estate-strategy/horizonSnapshots.ts` | Horizon snapshot columns (flat top rate on exposure) |
| `computeFederalEstateTax()` | `lib/calculations/estate-tax.ts` | Progressive brackets + exemption credit (`/estate-tax`, trust strategy) |
| `computeFederalExportTax()` | `lib/tax/federalExportTax.ts` | Advisor export panel, Excel, PDF (`exportMappers` → `PDFReportData.federalTax`) |
| `computeEstateTaxProjection()` | `lib/calculations/estate-tax-projection.ts` | Year-by-year projection rows (engine B at death years) |
| `currentFederalExemption()` | `lib/export/narrativeEngine.ts` | Display copy only |

---

## State income tax (NOT estate tax)

| Function | File | Use for |
|----------|------|---------|
| `calculateStateIncomeTax()` | `lib/calculations/stateIncomeTax.ts` | Progressive state income tax from **`state_income_tax_brackets`** |
| `calcStateTax()` | `lib/calculations/projection-complete.ts` | Wrapper in projection engine — calls **`calculateStateIncomeTax`** |

**Coverage:** 42 states + DC have 2026 brackets in DB. **`NO_STATE_INCOME_TAX_STATES`**: AK, FL, NV, NH, SD, TN, TX, WA, WY — zero brackets is correct ($0 tax).

---

## State inheritance tax (NOT estate tax)

| Function | File | Use for |
|----------|------|---------|
| `computeStateInheritanceTax()` | `lib/calculations/estate-tax.ts` | Consumer **`/estate-tax`** waterfall |
| `calculateInheritanceTax()` | `lib/projection/stateRegistry.ts` | Advisor **`InheritanceTaxWaterfall`** |

**Coverage:** **`MODELED_INHERITANCE_TAX_STATES`**: IA, KY, MD, NE, NJ, PA — rules in **`state_inheritance_tax_rules`**.

---

## Gifting

| Function | File | Use for |
|----------|------|---------|
| `calculate_gifting_summary()` | Supabase RPC | Lifetime used, remaining, annual capacity |

---

## Monte Carlo engines

Two separate engines — do not merge.

### Estate Monte Carlo (advisor Strategy tab)

| | |
|--|--|
| **Files** | `lib/calculations/estate-monte-carlo.ts` + `supabase/functions/estate-monte-carlo/index.ts` |
| **State tax** | Engine B (`calculateStateEstateTax` + `resolveActiveStateTax`) per simulated estate — **not** flat rate (removed 2026-06-01) |
| **Inputs** | `stateCode`, `stateBrackets`, `filingStatus`, `hasBypassTrust` via POST from Strategy tab (`MonteCarloPanel`) |
| **Storage** | `monte_carlo_results` — edge on Strategy tab Run; **`runEstateMonteCarloAsync`** after **`generateBaseCase`** (precompute + Phase 3 signals) |
| **Precomputed** | Yes — `percentiles_by_year` + Phase 3 signals via **`loadScenarioMonteCarlo`** |
| **Engine version** | Flat rate deprecated; engine B unified as of `fc85ff8` |

**`success_rate`:** Share of simulated final estates where federal + state estate tax both equal $0 (UI: **Zero-Tax Paths**).

**UI surfaces (precomputed):** Advisor **`MonteCarloPanel`** (edge + precomputed tiles; **`MonteCarloFanChart`**) · Strategy at-death badge · PDF page 2 fan bands + cover MC narrative (**`firstTaxYearP10`** stored signal, band-scan fallback) · consumer **`/projections`** **`EstateOutlookChart`** · consumer **`/estate-tax`** threshold copy.

**Gift exclusion constants:** **`lib/gifting/perRecipientLimit.ts`** — prefer **`calculate_gifting_summary.per_recipient_limit`**, fallback **`19_000`/`38_000`**.

### Retirement Monte Carlo (consumer `/monte-carlo`)

| | |
|--|--|
| **Files** | `lib/monte-carlo.ts`, `POST /api/monte-carlo` |
| **Storage** | `monte_carlo_runs` |
| **Purpose** | Consumer `/monte-carlo` — portfolio sustainability question |
| **State** | Unchanged (separate from estate MC) |

---

## Surfaces and canonical engine (post-unification)

| Surface | State estate tax engine | Trust-aware? |
|---------|-------------------------|--------------|
| PDF cover metric + callout | B via `narrativeEngine` + `stateBrackets` | Yes — `hasBypassTrust` |
| PDF page 3 scenario table | B — `calculateStateTaxScenarios` | Yes — both scenarios |
| Strategy horizons | B via `computeColumnTaxes` | Yes — `hasBypassTrust` threaded |
| Advisor tax tab | B via `StateTaxPanel` | Yes — `stateTaxWithCST` / `cstBenefit` |
| Consumer estate strategy | B via `computeColumnTaxes` | Yes — accepted CST line items |
| Estate tax projection rows | B — `calculateStateEstateTax` + `resolveActiveStateTax` at death years | Yes — `hasBypassTrust` from line items |
| Prospect mode | B via `calculateStateEstateTax` | Yes |
| Estate Monte Carlo (advisor Strategy tab) | B — see [Monte Carlo engines](#monte-carlo-engines) | Yes — `hasBypassTrust` |

**Export / PDF tax (2026-06-05):** PDF page 3 metric cards — engine B at render. Export panel + Excel **Tax Analysis** — engine B via `exportMappers.ts`. Excel **Projection** sheet + PDF SVG chart — per-row `estate_tax_*` from stored `outputs_s1_first` (engine B at death years after `generateBaseCase` regenerate).

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
