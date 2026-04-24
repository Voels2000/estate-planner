/**
 * lib/calculations/stateEstateTax.ts
 *
 * SESSION 34 — Single source of truth for state estate tax across all pages.
 *
 * Replaces three divergent implementations:
 *   - stateRegistry.ts  (blended rate approximation — RETIRED for tax calcs)
 *   - computeStateEstateTaxFromBrackets in estate-tax-projection.ts (no portability, no NY cliff)
 *   - calculate_estate_composition RPC (no portability, no NY cliff)
 *
 * All pages must import from here. The SQL RPC mirrors this logic exactly.
 *
 * Key rules encoded:
 *   1. Graduated brackets from state_estate_tax_rules (never blended rate approximations)
 *   2. No-portability states: WA, OR, MN, MA, ME, IL, MD, NJ, RI, VT, HI
 *      — MFJ without CST: only ONE exemption at second death
 *      — MFJ with CST:    TWO exemptions (double exemption)
 *   3. NY cliff: if gross estate > 105% of exemption, the FULL estate is taxable
 *   4. CT cap: state tax capped at $15M
 *   5. States not in DB: $0 state estate tax
 *
 * IRS / state mechanics:
 *   grossEstate
 *     - state exemption (one or two depending on CST)
 *   = stateTaxableEstate
 *   Apply graduated brackets to stateTaxableEstate
 *   = stateTax
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type StateBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type StateEstateTaxResult = {
  /** State tax without a Credit Shelter Trust (worst case for no-portability MFJ) */
  stateTax: number
  /** State tax WITH a Credit Shelter Trust in place (best case for no-portability MFJ) */
  stateTaxWithCST: number
  /** Dollar savings from implementing a CST. Zero for single or portability states. */
  cstBenefit: number
  /** True if state has no portability AND household is MFJ — means CST is actionable */
  hasPortabilityGap: boolean
  /** NY cliff was triggered (estate > 105% of exemption) */
  nyCliffTriggered: boolean
  /** Exemption used in the no-CST calculation */
  exemptionUsed: number
  /** Taxable estate in the no-CST calculation */
  taxableEstate: number
  /** Effective rate = stateTax / grossEstate */
  effectiveRate: number
}

// ─── No-portability states ────────────────────────────────────────────────────
// These states do not allow a surviving spouse to use the deceased spouse's
// unused exemption (DSUE). Without a Credit Shelter Trust, the first spouse's
// exemption is lost forever.

const NO_PORTABILITY_STATES = new Set([
  'WA', 'OR', 'MN', 'MA', 'ME', 'IL', 'MD', 'NJ', 'RI', 'VT', 'HI',
  'DC', 'NE', 'IA', 'KY', 'PA', // inheritance tax states — no estate portability either
])

// ─── Core bracket engine ──────────────────────────────────────────────────────

/**
 * Apply graduated state estate tax brackets to a taxable amount.
 * brackets must be sorted ascending by min_amount.
 * taxableAmount = grossEstate - exemption (caller's responsibility).
 */
function applyBrackets(taxableAmount: number, brackets: StateBracket[]): number {
  if (taxableAmount <= 0 || brackets.length === 0) return 0
  let tax = 0
  for (const bracket of brackets) {
    const bracketMin = bracket.min_amount
    const bracketMax = bracket.max_amount >= 9_999_999_999 ? Infinity : bracket.max_amount
    if (taxableAmount <= bracketMin) break
    const inBracket = Math.min(taxableAmount, bracketMax) - bracketMin
    if (inBracket > 0) tax += inBracket * (bracket.rate_pct / 100)
  }
  return Math.round(tax)
}

/**
 * Compute state estate tax for a given gross estate and exemption.
 * Handles NY cliff internally.
 */
function computeStateTaxForExemption(
  grossEstate: number,
  exemption: number,
  brackets: StateBracket[],
  stateCode: string,
): { tax: number; nyCliffTriggered: boolean; taxableEstate: number } {
  if (brackets.length === 0 || grossEstate <= 0) {
    return { tax: 0, nyCliffTriggered: false, taxableEstate: 0 }
  }

  let taxableEstate: number
  let nyCliffTriggered = false

  if (stateCode === 'NY') {
    // NY cliff: if gross estate exceeds 105% of exemption,
    // the FULL gross estate becomes taxable (no exemption benefit).
    const cliffThreshold = exemption * 1.05
    if (grossEstate > cliffThreshold) {
      taxableEstate = grossEstate // entire estate taxable — no exemption
      nyCliffTriggered = true
    } else {
      taxableEstate = Math.max(0, grossEstate - exemption)
    }
  } else {
    taxableEstate = Math.max(0, grossEstate - exemption)
  }

  if (taxableEstate <= 0) {
    return { tax: 0, nyCliffTriggered, taxableEstate: 0 }
  }

  let tax = applyBrackets(taxableEstate, brackets)

  // CT: state estate tax capped at $15M
  if (stateCode === 'CT') {
    tax = Math.min(tax, 15_000_000)
  }

  return { tax, nyCliffTriggered, taxableEstate: Math.round(taxableEstate) }
}

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Calculate state estate tax with full portability and NY cliff logic.
 *
 * @param grossEstate   - Total gross estate value
 * @param stateCode     - Two-letter state postal code (e.g. 'WA', 'NY')
 * @param brackets      - Rows from state_estate_tax_rules for this state+year,
 *                        sorted ascending by min_amount
 * @param isMFJ         - True if married filing jointly
 * @param hasCSTInPlace - True if a Credit Shelter Trust has been established
 *                        (used for the "with CST" scenario calculation)
 *
 * @returns StateEstateTaxResult with both scenarios and CST benefit
 */
export function calculateStateEstateTax(
  grossEstate: number,
  stateCode: string,
  brackets: StateBracket[],
  isMFJ: boolean,
  hasCSTInPlace = false,
): StateEstateTaxResult {
  const code = stateCode.toUpperCase().trim()

  // No brackets = no state estate tax for this state
  if (brackets.length === 0 || grossEstate <= 0) {
    return {
      stateTax: 0,
      stateTaxWithCST: 0,
      cstBenefit: 0,
      hasPortabilityGap: false,
      nyCliffTriggered: false,
      exemptionUsed: 0,
      taxableEstate: 0,
      effectiveRate: 0,
    }
  }

  // Exemption is consistent across all brackets for a given state+year
  const singleExemption = brackets[0].exemption_amount ?? 0
  const hasPortabilityGap = isMFJ && NO_PORTABILITY_STATES.has(code)

  // ── Without CST: MFJ no-portability states get only ONE exemption ──────────
  // This is the worst-case / status-quo scenario for those states.
  // For states with portability, MFJ effectively gets double exemption federally
  // but state tax is computed on gross estate with one state exemption at second death.
  const exemptionNoCst = singleExemption

  const noCst = computeStateTaxForExemption(grossEstate, exemptionNoCst, brackets, code)

  // ── With CST: MFJ no-portability states get DOUBLE exemption ──────────────
  // A Credit Shelter Trust "shelters" the first spouse's exemption so the
  // second estate can deduct both exemptions.
  // For states WITH portability or single filers, CST provides no additional benefit.
  const exemptionWithCst = hasPortabilityGap ? singleExemption * 2 : singleExemption
  const withCst = hasPortabilityGap
    ? computeStateTaxForExemption(grossEstate, exemptionWithCst, brackets, code)
    : noCst // same result — CST irrelevant for portability states

  const cstBenefit = Math.max(0, noCst.tax - withCst.tax)

  // Primary stateTax = no-CST (worst case / status quo)
  // Caller uses stateTaxWithCST for the "with planning" scenario
  const effectiveRate = grossEstate > 0 ? noCst.tax / grossEstate : 0

  return {
    stateTax: noCst.tax,
    stateTaxWithCST: withCst.tax,
    cstBenefit,
    hasPortabilityGap,
    nyCliffTriggered: noCst.nyCliffTriggered,
    exemptionUsed: exemptionNoCst,
    taxableEstate: noCst.taxableEstate,
    effectiveRate,
  }
}

// ─── Convenience re-export for callers that only need the bracket engine ──────
// estate-tax-projection.ts uses this directly for death-year rows.
// Import from here instead of estate-tax-projection.ts going forward.

/**
 * @deprecated Use calculateStateEstateTax instead.
 * Kept for backward compatibility with computeEstateTaxProjection death-year rows.
 * Does NOT handle portability or NY cliff.
 */
export function computeStateEstateTaxFromBrackets(
  grossEstate: number,
  brackets: StateBracket[],
): number {
  if (brackets.length === 0) return 0
  const exemption = brackets[0].exemption_amount ?? 0
  return applyBrackets(Math.max(0, grossEstate - exemption), brackets)
}

// ─── Helper: derive isMFJ from filing status string ──────────────────────────

export function isMFJFilingStatus(filingStatus: string | null | undefined): boolean {
  const fs = (filingStatus ?? '').toLowerCase().trim()
  return fs === 'mfj' || fs === 'married_filing_jointly' || fs === 'married filing jointly' || fs === 'married_joint'
}

// ─── Helper: does this state have an estate tax at all? ──────────────────────

export function stateHasEstateTax(stateCode: string | null | undefined): boolean {
  if (!stateCode) return false
  // States in state_estate_tax_rules table as of Session 34
  const ESTATE_TAX_STATES = new Set([
    'CT', 'DC', 'HI', 'IA', 'IL', 'KY', 'MA', 'MD', 'ME',
    'MN', 'NE', 'NJ', 'NY', 'OR', 'PA', 'RI', 'VT', 'WA',
  ])
  return ESTATE_TAX_STATES.has(stateCode.toUpperCase().trim())
}

// ─── Helper: portability gap label for UI ────────────────────────────────────

export function getPortabilityGapLabel(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null
  const code = stateCode.toUpperCase().trim()
  if (!NO_PORTABILITY_STATES.has(code)) return null
  const STATE_NAMES: Record<string, string> = {
    WA: 'Washington', OR: 'Oregon', MN: 'Minnesota', MA: 'Massachusetts',
    ME: 'Maine', IL: 'Illinois', MD: 'Maryland', NJ: 'New Jersey',
    RI: 'Rhode Island', VT: 'Vermont', HI: 'Hawaii',
  }
  const name = STATE_NAMES[code] ?? code
  return `${name} does not recognize federal portability. Without a Credit Shelter Trust, one spouse's exemption is lost at first death.`
}
