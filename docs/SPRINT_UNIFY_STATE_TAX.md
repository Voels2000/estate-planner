# SPRINT — Unify State Estate Tax to Engine B
# My Wealth Maps — Estate Planning
# ─────────────────────────────────────────────────────────────────
# Read this entire file before making any change.
# Work in phase order. Run `tsc --noEmit` after each phase.
#
# GOVERNANCE: Every Cursor session that touches tax calculations must start
# with "read docs/CALCULATION_ENGINES.md". See docs/NEXT_SESSION.md § Standing rules.
#
# BACKGROUND
# There are three state estate tax implementations in the codebase:
#   A — narrativeEngine.ts calcStateTax()        HARDCODED flat rates — DELETE
#   B — lib/calculations/stateEstateTax.ts       Progressive brackets, portability,
#         calculateStateEstateTax()               NY cliff, CST modeling — CANONICAL
#   C — computeStateEstateTaxFromBrackets()      Brackets only, single exemption,
#         same file as B, deprecated             used only in projection death rows
#
# GOAL: Delete A. Replace every call to A with B.
#       Thread hasBypassTrust into computeColumnTaxes so B's existing CST
#       logic activates correctly on all horizon and consumer surfaces.
#       No new engine file needed — B already does what we need.
#
# DO NOT touch engine C or the projection death-year pipeline this sprint.
# That is a separate, larger change.

---

## PRE-FLIGHT — confirm B's interface before writing anything

Run this and paste the output before starting:

```bash
grep -n "export function calculateStateEstateTax\|export interface\|hasBypassTrust\|hasCST\|bypassTrust\|portability" \
  lib/calculations/stateEstateTax.ts | head -40
```

This confirms:
1. The exact parameter name B uses for bypass trust (`hasCSTInPlace`, `hasBypassTrust`, or similar)
2. Whether B already accepts a trust parameter or needs one wired (today: `hasCSTInPlace` exists but is `void`ed)
3. The return type shape (`stateTax`, `stateTaxWithCST`, `cstBenefit`, etc.)

Also run:
```bash
grep -n "calcStateTax\|narrativeEngine" \
  lib/export/narrativeEngine.ts | head -20
```

This confirms the exact lines where A is defined and called in narrativeEngine.ts.

Paste both outputs here before proceeding. The phase instructions below assume
B already accepts a trust/CST parameter based on the audit. If it is not wired,
Phase 1 activates it before anything else.

---

## PHASE 0 — CST strategy string constants (run before Phase 1)

**Problem:** `credit_shelter_trust` in read paths vs `cst` in write paths means
`hasBypassTrust` would never be true in production. Hardcoding strings at each
caller will recreate the mismatch.

### 0A. Create shared constants file

**File: `lib/constants/strategyTypes.ts`**

Single source of truth — import from here; never hardcode CST type/source strings
at DB query or comparison call sites:

```typescript
/** Values used in strategy_configs.strategy_type for credit shelter / bypass trust */
export const CST_STRATEGY_TYPES = ['cst', 'credit_shelter_trust', 'bypass_trust'] as const

/** Values used in strategy_line_items.strategy_source for credit shelter / bypass trust */
export const CST_STRATEGY_SOURCES = ['cst'] as const

export const CST_STRATEGY_SOURCE = CST_STRATEGY_SOURCES[0]

/** All known strategy_configs types (from DB constraint) */
export const STRATEGY_CONFIG_TYPES = [
  'gifting', 'revocable_trust', 'cst', 'slat', 'ilit',
  'grat', 'crt', 'clat', 'daf', 'roth_conversion',
] as const

export function isCstStrategyType(value: string | null | undefined): boolean
export function isCstStrategySource(value: string | null | undefined): boolean
```

When the DB constraint changes the canonical string, update **this file only**.

### 0B. Grep audit — fix before threading hasBypassTrust

Run **after** `strategyTypes.ts` exists, **before** touching Phase 5D callers:

```bash
grep -rn "credit_shelter_trust\|bypass_trust\|'cst'" \
  lib/ app/ components/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" \
  | grep -v "strategyTypes.ts"
```

Every hit at a **DB query or equality comparison** must use `CST_STRATEGY_TYPES`,
`CST_STRATEGY_SOURCES`, `CST_STRATEGY_SOURCE`, `isCstStrategyType()`, or
`isCstStrategySource()`.

**Required replacements (minimum):**

| File | Was | Use |
|------|-----|-----|
| `EstateTab.tsx` | `.eq('strategy_type', 'credit_shelter_trust')` | `.in('strategy_type', [...CST_STRATEGY_TYPES])` |
| `fetchNarrativePdfFields.ts` | `'credit_shelter_trust'` in `.in()` | `...CST_STRATEGY_TYPES` |
| `page.tsx` (advisor client) | `strategy_source === 'cst'` | `isCstStrategySource(...)` |
| `AdvancedStrategyPanel.tsx` | `'cst'` writes | `CST_STRATEGY_SOURCE` |
| `estimateStrategySavings.ts` | alias map to `'cst'` | `isCstStrategyType` + `CST_STRATEGY_SOURCE` |

Display label maps keyed by UI panel id (`credit_shelter_trust`) may remain if
they are not used for DB filters — but any value compared to DB columns must
use the constants.

Re-run the grep until **zero DB-comparison hits** remain outside `strategyTypes.ts`.

Run `tsc --noEmit` after Phase 0.

---

## PHASE 1 — Add hasBypassTrust to engine B (if not already present)

**File: `lib/calculations/stateEstateTax.ts`**

CHECK FIRST: if `calculateStateEstateTax` already accepts `hasCST` or
`hasBypassTrust` as a parameter **and the flag is wired**, skip this phase entirely.

If the parameter does not exist or is voided, wire it:

### 1A. Extend the input type

Find the params type for `calculateStateEstateTax`. Add:

```typescript
hasBypassTrust?: boolean   // true if credit shelter trust active in strategy_configs
                           // only affects MFJ households in no-portability states
                           // no-portability states: WA, OR, MN, MA, IL, NY
```

(If B already uses `hasCSTInPlace`, wire that param instead of adding a duplicate name.)

### 1B. Add bypass trust logic inside calculateStateEstateTax

Find the section where exemption and taxable estate are computed.
After the existing portability/DSUE logic, add:

```typescript
// Bypass trust: for MFJ in no-portability states, a funded CST at first death
// preserves the deceased spouse's state exemption. Without it, the exemption
// is permanently lost and the surviving spouse gets only one exemption.
//
// With CST:    effective exemption = stateExemption (survivor only, but bypass
//              trust assets are already outside survivor's estate)
//              survivorEstate = grossEstate - Math.min(grossEstate/2, stateExemption)
//              tax = calculateStateEstateTax(survivorEstate, ...)
//
// Without CST: effective exemption = stateExemption (one exemption, full estate)
//              tax = calculateStateEstateTax(grossEstate, ...)   ← current behavior
//
// Current behavior (no bypass trust) is already correct as the default.
// We only need to add the WITH bypass trust path.

const noPortabilityStates = ['WA', 'OR', 'MN', 'MA', 'IL', 'NY']
const isNoPortability = noPortabilityStates.includes(stateCode?.toUpperCase() ?? '')
const isMarriedFiling = ['mfj','married_filing_jointly','married']
  .includes((filingStatus ?? '').toLowerCase())

if (params.hasBypassTrust && isNoPortability && isMarriedFiling) {
  // Bypass trust path: compute survivor estate after bypass funding
  const stateExemptionAmount = getStateExemptionForYear(stateCode, year, federalExemption)
  const bypassFunding  = Math.min(grossEstate / 2, stateExemptionAmount)
  const survivorEstate = grossEstate - bypassFunding

  // Recurse with survivor estate only, no bypass flag (prevents infinite recursion)
  return calculateStateEstateTax({ ...params, grossEstate: survivorEstate, hasBypassTrust: false })
}
// Default path (no bypass trust) continues with existing logic below — no change needed
```

NOTE: The recursive call uses the survivor estate. The return value represents
second-death tax only (first death = $0 via marital deduction). This matches
the no-trust path which also represents second-death tax on the full estate.

### 1C. Export a second convenience function for scenario comparison

Add this after `calculateStateEstateTax`:

```typescript
/**
 * Returns both bypass-trust scenarios for advisor comparison display.
 * Use this for the PDF tax analysis page scenario table.
 * For single-number display, use calculateStateEstateTax() with hasBypassTrust set.
 */
export function calculateStateTaxScenarios(params: Omit<
  Parameters<typeof calculateStateEstateTax>[0], 'hasBypassTrust'
> & { filingStatus: string }) {
  const withTrust    = calculateStateEstateTax({ ...params, hasBypassTrust: true })
  const withoutTrust = calculateStateEstateTax({ ...params, hasBypassTrust: false })
  const planningGap  = withoutTrust.stateTax - withTrust.stateTax

  const noPortabilityStates = ['WA', 'OR', 'MN', 'MA', 'IL', 'NY']
  const hasPortability = !noPortabilityStates.includes(
    (params.stateCode ?? '').toUpperCase()
  )

  return {
    withBypassTrust:    withTrust,
    withoutBypassTrust: withoutTrust,
    planningGap,
    hasPortability,
    showScenarioTable: planningGap > 0,
  }
}
```

---

## PHASE 2 — Delete engine A from narrativeEngine.ts

**File: `lib/export/narrativeEngine.ts`**

### 2A. Add import for engine B

Add at the top of the file:

```typescript
import {
  calculateStateEstateTax,
  calculateStateTaxScenarios,
} from '@/lib/calculations/stateEstateTax'
```

### 2B. Delete the hardcoded STATE_TAX constant

Find and delete the entire `STATE_TAX` constant — the Record with hardcoded
exemptions and flat rates for WA, OR, MN, MA, IL, NY, TX etc.

This is the only place in the codebase with hardcoded state estate tax rates.
Deleting it is the primary goal of this sprint.

### 2C. Delete the getStateTaxInfo() function

Find and delete `function getStateTaxInfo(state: string)` entirely.

### 2D. Delete the inline calcStateTax() function

Find and delete `function calcStateTax(...)` in narrativeEngine.ts entirely.
(Do not touch the calcStateTax in projection-complete.ts — that is state
INCOME tax, completely separate.)

### 2E. Replace calls in generateExecutiveSummary

Find every call to `calcStateTax(...)` and `getStateTaxInfo(...)` inside
`generateExecutiveSummary`. Replace with:

```typescript
const stateTaxResult = calculateStateEstateTax({
  grossEstate:    data.grossEstate,
  stateCode:      data.domicileState,
  year:           new Date().getFullYear(),
  filingStatus:   data.filingStatus,
  hasBypassTrust: data.hasIrrevocableTrust,
})
const stateTax   = stateTaxResult.stateTax
const stateInfo  = stateTaxResult  // has .nyCliffTriggered, .taxableEstate etc.
```

Then update all references:
- `stateInfo.hasStateTax` → `stateTax > 0 || data.domicileState !== 'TX' /* etc */`
  BETTER: add `hasStateTax` to the return type of `calculateStateEstateTax` if
  not present, or derive from stateCode lookup
- `stateInfo.name` → derive from a simple state name map (5 lines, not a full registry):
  ```typescript
  const STATE_NAMES: Record<string, string> = {
    WA:'Washington', OR:'Oregon', MN:'Minnesota',
    MA:'Massachusetts', IL:'Illinois', NY:'New York',
  }
  const stateName = STATE_NAMES[data.domicileState] ?? data.domicileState
  ```
- `st.tax` → `stateTax`

### 2F. Replace calls in generateTaxCallout

Same pattern — replace `calcStateTax(...)` with `calculateStateEstateTax({...})`.

The callout also needs to surface the planning gap. After computing `stateTaxResult`,
compute the scenarios:

```typescript
const scenarios = calculateStateTaxScenarios({
  grossEstate:  data.grossEstate,
  stateCode:    data.domicileState,
  year:         new Date().getFullYear(),
  filingStatus: data.filingStatus,
})
const planningGap = scenarios.planningGap
```

Then in the callout `detail` string, if `planningGap > 100_000` append:
```typescript
` Without a bypass trust, ${stateName} tax increases by ${fmt(planningGap)}.`
```

### 2G. Verify deletion is complete

```bash
grep -n "calcStateTax\|getStateTaxInfo\|STATE_TAX\b" lib/export/narrativeEngine.ts
```

Must return zero results. If any remain, they are unintentional and must be removed.

---

## PHASE 3 — Update generatePDFReport.ts cover metric

**File: `lib/export/generatePDFReport.ts`**

The cover page "Est. total tax exposure" metric currently calls engine A inline:
```typescript
calcStateTax(data.grossEstate, data.domicileState, data.filingStatus)
```

This line is inside the `generatePDFHTML` function. Replace it with:

```typescript
import { calculateStateEstateTax } from '@/lib/calculations/stateEstateTax'
// (add to imports at top of file)

// In the cover metric:
const coverStateTax = calculateStateEstateTax({
  grossEstate:    data.grossEstate,
  stateCode:      data.domicileState,
  year:           new Date().getFullYear(),
  filingStatus:   data.filingStatus,
  hasBypassTrust: data.hasIrrevocableTrust,
}).stateTax

// Then use coverStateTax in the metric display instead of the inline call
```

---

## PHASE 4 — Update PDF page 3 tax analysis section

**File: `lib/export/generatePDFReport.ts`**

Page 3 currently shows `data.stateTax` sourced from the projection row (engine C).
This is a single number with no scenario comparison.

### 4A. Add scenario computation in generatePDFHTML

Near the top of `generatePDFHTML`, after the existing narrative engine calls, add:

```typescript
import { calculateStateTaxScenarios } from '@/lib/calculations/stateEstateTax'

const stateTaxScenarios = calculateStateTaxScenarios({
  grossEstate:  data.grossEstate,
  stateCode:    data.domicileState,
  year:         new Date().getFullYear(),
  filingStatus: data.filingStatus,
})
```

### 4B. Replace page 3 state tax section

Find the page 3 state tax metric card and the existing 2-row scenario table.
Replace with this conditional:

```typescript
${stateTaxScenarios.showScenarioTable ? `
  <div class="section-title">
    ${stateName} estate tax — planning scenario comparison
  </div>
  <table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:10pt;">
    <tr style="background:#2E4057;color:#fff;">
      <th style="padding:8px 10px;text-align:left;">Scenario</th>
      <th style="padding:8px 10px;text-align:right;">State tax</th>
      <th style="padding:8px 10px;text-align:right;">Net to heirs</th>
    </tr>
    <tr style="background:#f0f7f0;">
      <td style="padding:8px 10px;">
        <strong>With bypass trust</strong><br>
        <span style="font-size:9pt;color:#555;">
          Both spouses' exemptions preserved
        </span>
      </td>
      <td style="padding:8px 10px;text-align:right;color:#166534;font-weight:bold;">
        ${fmt(stateTaxScenarios.withBypassTrust.stateTax)}
      </td>
      <td style="padding:8px 10px;text-align:right;">
        ${fmt(data.grossEstate - stateTaxScenarios.withBypassTrust.stateTax)}
      </td>
    </tr>
    <tr style="background:#fef2f2;">
      <td style="padding:8px 10px;">
        <strong>Without bypass trust (current situation)</strong><br>
        <span style="font-size:9pt;color:#555;">
          First spouse's exemption permanently lost at death
        </span>
      </td>
      <td style="padding:8px 10px;text-align:right;color:#991b1b;font-weight:bold;">
        ${fmt(stateTaxScenarios.withoutBypassTrust.stateTax)}
      </td>
      <td style="padding:8px 10px;text-align:right;">
        ${fmt(data.grossEstate - stateTaxScenarios.withoutBypassTrust.stateTax)}
      </td>
    </tr>
    <tr style="background:#fffbeb;border-top:2px solid #d97706;">
      <td style="padding:8px 10px;"><strong>Bypass trust planning benefit</strong></td>
      <td style="padding:8px 10px;text-align:right;color:#92400e;font-weight:bold;">
        ${fmt(stateTaxScenarios.planningGap)} saved
      </td>
      <td style="padding:8px 10px;text-align:right;color:#92400e;">
        ${fmt(stateTaxScenarios.planningGap)} more to heirs
      </td>
    </tr>
  </table>
  <div style="background:#fff8e1;border:1px solid #fbbf24;border-radius:5px;
              padding:10px 14px;font-size:9.5pt;color:#451a03;margin-bottom:12px;">
    ${STATE_PORTABILITY_NOTES[data.domicileState] ?? ''}
  </div>
` : `
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">Federal estate tax</div>
      <div class="metric-value">${fmt(data.federalTax ?? 0)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">${stateName} estate tax</div>
      <div class="metric-value">${fmt(stateTaxScenarios.withoutBypassTrust.stateTax)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Net to heirs</div>
      <div class="metric-value">
        ${fmt(data.grossEstate - (data.federalTax ?? 0) - stateTaxScenarios.withoutBypassTrust.stateTax)}
      </div>
    </div>
  </div>
`}
```

### 4C. Add STATE_PORTABILITY_NOTES constant

Add this constant near the top of `generatePDFReport.ts` (not in narrativeEngine):

```typescript
const STATE_PORTABILITY_NOTES: Record<string, string> = {
  WA: 'Washington does not allow portability of its estate tax exemption. Without a credit shelter trust funded at first death, the first spouse\'s $3M exemption is permanently lost. The surviving spouse receives only their own $3M exemption on second death.',
  OR: 'Oregon does not allow portability of its estate tax exemption. At Oregon\'s $1M threshold, a bypass trust is critical for nearly every married estate over $1M.',
  MN: 'Minnesota does not allow portability of its estate tax exemption. A bypass trust preserves both spouses\' $3M exemptions across both deaths.',
  MA: 'Massachusetts does not allow portability and applies a cliff tax: once the estate exceeds $2M, the entire estate is taxed. A bypass trust both preserves the first-death exemption and keeps the survivor\'s estate below the cliff.',
  IL: 'Illinois does not allow portability of its estate tax exemption. A bypass trust preserves both spouses\' $4M exemptions.',
  NY: 'New York does not allow portability and applies a cliff tax at 105% of the exemption: if the estate exceeds this threshold, the entire estate is taxed at full rates. Precise planning is critical.',
}
```

---

## PHASE 5 — Thread hasBypassTrust into computeColumnTaxes

**File: `lib/my-estate-strategy/horizonSnapshots.ts`**

Engine B (`calculateStateEstateTax`) is already called by `computeColumnTaxes`.
The only missing piece is the `hasBypassTrust` parameter.

### 5A. Extend computeColumnTaxes params

```typescript
export function computeColumnTaxes(params: {
  grossEstate:     number
  calendarYear:    number
  statePrimary:    string | null | undefined
  filingStatus:    string | null | undefined
  hasSpouse:       boolean
  stateBrackets?:  StateBracket[]   // keep if already present
  hasBypassTrust?: boolean          // ADD THIS
}): { ... }
```

### 5B. Pass hasBypassTrust into calculateStateEstateTax call

Find the existing `calculateStateEstateTax({...})` call inside `computeColumnTaxes`.
Add `hasBypassTrust: params.hasBypassTrust ?? false` to the params object.

### 5C. Extend BuildHorizonsInput and thread through buildStrategyHorizons

Add `hasBypassTrust?: boolean` to `BuildHorizonsInput`.

Find every call to `computeColumnTaxes` inside `buildStrategyHorizons` and add
`hasBypassTrust: input.hasBypassTrust ?? false`.

**Important:** `buildStrategyHorizons` is called from both advisor and consumer
contexts. It must **receive** `hasBypassTrust` from the caller — it must **not**
derive the flag itself (advisor vs consumer use different source tables).

### 5D. Update all callers of buildStrategyHorizons

#### Step 1 — NON-NEGOTIABLE: run pre-flight SQL before any caller changes

The `strategy_type` / `strategy_source` value for credit shelter trust in your DB
determines whether `hasBypassTrust` ever returns true. If the code checks
`'credit_shelter_trust'` but the DB stores `'cst'`, the bypass trust path never
activates and every MFJ household shows worst-case even after the trust is established.

Run **both** queries against production (or staging with real data) and paste results
into the sprint notes before editing callers:

```sql
-- strategy_configs (advisor modeling panels, legacy notifications)
SELECT DISTINCT strategy_type
FROM strategy_configs
WHERE strategy_type ILIKE '%trust%'
   OR strategy_type ILIKE '%bypass%'
   OR strategy_type ILIKE '%shelter%'
   OR strategy_type ILIKE '%cst%';

-- strategy_line_items (integration layer — consumer acceptance gate)
SELECT DISTINCT strategy_source
FROM strategy_line_items
WHERE strategy_source ILIKE '%trust%'
   OR strategy_source ILIKE '%bypass%'
   OR strategy_source ILIKE '%shelter%'
   OR strategy_source ILIKE '%cst%';
```

Use whatever values these return — **do not assume** `'credit_shelter_trust'`.
The DB constraint on `strategy_line_items.strategy_source` allows `'cst'`;
`AdvancedStrategyPanel` writes `'cst'` to line items when recommending CST.

**Pre-flight run (2026-05-29, production):** no CST rows in either table yet;
when present, expect `strategy_line_items.strategy_source = 'cst'`. Some read
paths still query `strategy_configs.strategy_type = 'credit_shelter_trust'` —
align callers to the SQL results, not to UI panel IDs.

#### Step 2 — Two systems: who reads what

| Surface | What it reads | Trust-aware trigger |
|---|---|---|
| Consumer horizon table | `strategy_line_items` where `consumer_accepted = true` | Accepted CST line item only |
| Consumer accepts recommendation | `consumer_accepted = true`, `accepted_at` set, `fireRecompute()` | Then visible in horizons |
| Advisor StrategyOverlay / AdvancedStrategyPanel | Writes `strategy_line_items` (`strategy_source = 'cst'`) | Advisor recommendation (not in consumer horizons until accepted) |
| Advisor horizon snapshots (`advisorHorizons`) | `strategy_line_items` (both roles merged for projected view) | Advisor sees full picture |
| `hasBypassTrust` for state tax (this sprint) | **Caller-dependent** — see below | Must match viewer context |

**Consumer ownership (Sessions 95–97):** consumer pages read only
`source_role = 'consumer'` items **or** items where `consumer_accepted = true`.
An advisor recommendation sitting unaccepted does **not** flow into consumer
horizon calculations.

```
Advisor recommends  →  strategy_line_items (source_role='advisor', consumer_accepted=false)
                                ↓
                    NOT visible in consumer horizons yet
                                ↓
Consumer accepts    →  consumer_accepted=true, accepted_at set, fireRecompute()
                                ↓
                    NOW visible in consumer horizons
```

#### Step 3 — grep callers, then pass hasBypassTrust from the right source

```bash
grep -rn "buildStrategyHorizons\|computeColumnTaxes" \
  app/ components/ lib/ pages/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"
```

For each caller, pass `hasBypassTrust` using the **viewer context** — import
from `@/lib/constants/strategyTypes` (never hardcode strings):

```typescript
import {
  CST_STRATEGY_TYPES,
  CST_STRATEGY_SOURCES,
  isCstStrategyType,
  isCstStrategySource,
} from '@/lib/constants/strategyTypes'

// Advisor horizon view — strategy_configs
hasBypassTrust: strategyConfigs?.some(
  s => isCstStrategyType(s.strategy_type) && s.is_active
) ?? false

// Consumer horizon view — strategy_line_items accepted only
hasBypassTrust: acceptedLineItems.some(
  s => isCstStrategySource(s.strategy_source) && s.is_active
)
```

**Call sites (known):**

| File | Context | hasBypassTrust source |
|---|---|---|
| `lib/advisor/strategyMappers.ts` | Advisor horizons | `strategy_configs` **or** active CST in merged line items (advisor view) |
| `app/(dashboard)/my-estate-strategy/page.tsx` | Consumer horizons | `actualStrategyLineItems` only (accepted advisor + consumer items) |
| `app/(dashboard)/my-estate-trust-strategy/page.tsx` | Consumer trust strategy | Same — accepted line items only |

`buildStrategyHorizons` must not import or query strategy tables internally for
this flag — the caller computes and passes `hasBypassTrust`.

---

## PHASE 6 — Verify no remaining engine A calls (ongoing smoke test)

Run these **before commit** and **after every future sprint** that touches any
calculation file. Zero results means the engine registry is being respected.
Any result means someone added a duplicate implementation — fix before ship.

```bash
# Should return ZERO results after this sprint
grep -rn "STATE_TAX\b\|getStateTaxInfo\b" \
  lib/ app/ components/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"

# calcStateTax should only appear in projection-complete.ts (state INCOME tax)
# Any other file is a bug
grep -rn "calcStateTax" \
  lib/ app/ components/ \
  --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" \
  | grep -v "projection-complete"
```

Both commands must return zero results. If they don't, find and fix each remaining
reference before committing.

Standing rule: documented in [NEXT_SESSION.md](./NEXT_SESSION.md) § Standing rules
and [CALCULATION_ENGINES.md](./CALCULATION_ENGINES.md) § Regression grep checks.

---

## PHASE 7 — Add canonical function registry comment to stateEstateTax.ts

**File: `lib/calculations/stateEstateTax.ts`**

Add this comment block at the very top of the file, above all imports:

```typescript
/**
 * CANONICAL STATE ESTATE TAX ENGINE
 * ==================================
 * This is the single source of truth for state estate tax calculations.
 * ALL surfaces that display state estate tax must import from this file.
 *
 * DO NOT add state estate tax logic to:
 *   - narrativeEngine.ts (deleted in state-tax-unification sprint)
 *   - exportMappers.ts
 *   - generatePDFReport.ts (import from here instead)
 *   - any component file
 *
 * Exported functions:
 *   calculateStateEstateTax()   — single scenario, trust-aware via hasBypassTrust
 *   calculateStateTaxScenarios() — both scenarios for advisor PDF comparison table
 *
 * Engine C (computeStateEstateTaxFromBrackets) is DEPRECATED.
 * It remains only for the projection death-year pipeline (estate-tax-projection.ts).
 * Do not use it for display surfaces.
 *
 * @see docs/CALCULATION_ENGINES.md for the full canonical function registry
 */
```

---

## PHASE 8 — Create / update CALCULATION_ENGINES.md

**File: `docs/CALCULATION_ENGINES.md`**

Create or update this file and commit it with the sprint. This is the governance
document that prevents engine proliferation from recurring. Every future Cursor
sprint that touches tax calculations must start with **"read CALCULATION_ENGINES.md"**.

See the committed file for the full registry. Update the "Last updated" date and
the surfaces table when this sprint ships.

---

## SMOKE TEST

### Voels — $9.3M, WA, MFJ, no bypass trust

After this sprint:

| Surface | Expected | Verify |
|---|---|---|
| PDF cover "Est. total tax exposure" | federal $0 + WA ~$231K = ~$231K | Uses B now, not A |
| PDF page 3 scenario table | With trust: ~$0–70K · Without trust: ~$231K · Gap: ~$160–231K | New table renders |
| PDF page 3 portability note box | WA note visible | `STATE_PORTABILITY_NOTES['WA']` renders |
| Strategy horizon — today | State tax ~$231K | hasBypassTrust=false threaded |

### Consistency check

```bash
# All three numbers should now be the same source (B)
# Old: cover used A (~$231K flat rate), page 3 used C (projection row, may differ)
# New: both use B with same inputs — numbers should match
```

---

## COMMIT MESSAGE

```
refactor: unify state estate tax to single canonical engine (B)

Problem: three state estate tax implementations existed:
  A — narrativeEngine.ts — hardcoded flat rates and exemptions (DELETED)
  B — stateEstateTax.ts calculateStateEstateTax() — progressive, trust-aware (CANONICAL)
  C — computeStateEstateTaxFromBrackets() — deprecated, projection rows only

Changes:
- lib/constants/strategyTypes.ts: CST_STRATEGY_TYPES, CST_STRATEGY_SOURCES, helpers (Phase 0).
  Mismatch fixes: EstateTab, fetchNarrativePdfFields, AdvancedStrategyPanel writes,
  advisor page.tsx, estimateStrategySavings.
- narrativeEngine.ts: deleted STATE_TAX constant, getStateTaxInfo(),
  and inline calcStateTax(). All calls replaced with calculateStateEstateTax() (B).
- generatePDFReport.ts: cover metric now uses B (not inline A).
  Tax analysis page now uses calculateStateTaxScenarios() for
  two-scenario comparison table (with/without bypass trust).
  STATE_PORTABILITY_NOTES added for WA/OR/MN/MA/IL/NY.
- horizonSnapshots.ts: hasBypassTrust threaded into computeColumnTaxes()
  and buildStrategyHorizons(). Caller passes flag (advisor strategy_configs
  vs consumer accepted strategy_line_items).
- stateEstateTax.ts: wired hasBypassTrust / hasCSTInPlace on calculateStateEstateTax().
  Added calculateStateTaxScenarios() for advisor comparison table.
  Added canonical engine registry comment.
- docs/CALCULATION_ENGINES.md: authoritative engine registry + grep smoke tests.
- docs/SPRINT_UNIFY_STATE_TAX.md: sprint script with Phase 5D dual-source rules.

Post-sprint: all display surfaces use B. Engine A is gone.
Engine C remains only in estate-tax-projection.ts (projection death rows).
```
