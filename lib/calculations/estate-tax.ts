/**
 * Federal estate tax and IRC §121 (home sale exclusion) helpers.
 *
 * Estate tax: tentative tax is computed on the full taxable estate using the
 * progressive rate schedule (same stacking pattern as federal income tax in
 * scenarios/projections). The unified credit is modeled as the tentative tax
 * that would apply to the applicable exclusion amount at those rates, so
 * net tax = max(0, tax_on_estate − credit_on_exemption).
 */

/** 2024 basic exclusion amount per person (Rev. Proc. 2023-34). */
export const FEDERAL_EXEMPTION_2024 = 13_610_000

/** One row of the federal estate (or gift) tax rate schedule. */
export type EstateTaxBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
}

export type FederalEstateTaxResult = {
  /** Estate after debts and excluded trust assets (input to exemption/credit). */
  taxable_estate: number
  /** Portion of the estate sheltered by the applicable exclusion (capped at estate size). */
  exemption_used: number
  /** Tentative transfer tax from dollar one through the bracket schedule. */
  tax_before_credit: number
  /** Credit offsetting tax on the applicable exclusion amount (unified credit analog). */
  applicable_credit: number
  /** Tentative tax minus applicable credit, not below zero. */
  net_estate_tax: number
}

/**
 * Applies progressive brackets to a positive base amount.
 * Same stacking logic as `calcFederalTax` on scenarios/projections pages:
 * sort by `min_amount`, then for each bracket take min(base, max) − min.
 */
function computeProgressiveTaxFromBrackets(
  taxableBase: number,
  brackets: EstateTaxBracket[]
): number {
  if (taxableBase <= 0 || brackets.length === 0) return 0

  const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount)
  let tax = 0

  for (const bracket of sorted) {
    const bracketMin = bracket.min_amount
    // Treat very large max as unlimited top bracket
    const bracketMax =
      !Number.isFinite(bracket.max_amount) || bracket.max_amount >= 1e15
        ? Infinity
        : bracket.max_amount

    // No tax in this bracket until base exceeds its floor
    if (taxableBase <= bracketMin) break

    const taxableInBracket = Math.min(taxableBase, bracketMax) - bracketMin
    if (taxableInBracket > 0) {
      tax += taxableInBracket * (bracket.rate_pct / 100)
    }
  }

  return Math.round(tax * 100) / 100
}

/**
 * Total unified exclusion for the filing picture.
 * `married_joint` models portability (two BEAs) → double the per-person amount.
 */
function applicableExemptionAmount(filingStatus: string): number {
  const isJoint = filingStatus === 'married_joint'
  return isJoint ? FEDERAL_EXEMPTION_2024 * 2 : FEDERAL_EXEMPTION_2024
}

/**
 * Federal estate tax (simplified Form 706-style).
 *
 * @param grossEstate — Total assets of the gross estate
 * @param liabilities — Debts and other deductions (mortgages, etc.)
 * @param trustsExcluded — Assets removed from estate (e.g. irrevocable trust corpus)
 * @param filingStatus — `married_joint` uses doubled exemption (portability); others use single BEA
 * @param brackets — IRC §2001(c)-style progressive schedule (min/max/rate_pct)
 */
export function computeFederalEstateTax(
  grossEstate: number,
  liabilities: number,
  trustsExcluded: number,
  filingStatus: string,
  brackets: EstateTaxBracket[]
): FederalEstateTaxResult {
  // Net amount potentially subject to estate tax after simple deductions
  const taxable_estate = Math.max(
    0,
    grossEstate - liabilities - trustsExcluded
  )

  const exemptionCap = applicableExemptionAmount(filingStatus)

  // Tentative tax on the entire taxable estate from the first dollar
  const tax_before_credit = computeProgressiveTaxFromBrackets(
    taxable_estate,
    brackets
  )

  // Unified credit analog: tax that the schedule assigns to the exclusion amount
  const applicable_credit = computeProgressiveTaxFromBrackets(
    exemptionCap,
    brackets
  )

  const net_estate_tax = Math.max(
    0,
    Math.round((tax_before_credit - applicable_credit) * 100) / 100
  )

  // How much of the estate is "used up" against the exclusion for reporting
  const exemption_used = Math.min(taxable_estate, exemptionCap)

  return {
    taxable_estate,
    exemption_used,
    tax_before_credit,
    applicable_credit,
    net_estate_tax,
  }
}

/** §121(b)(2): $500,000 for joint sellers; $250,000 otherwise. */
const SECTION_121_CAP_SINGLE = 250_000
const SECTION_121_CAP_MFJ = 500_000

/**
 * IRC §121 principal residence gain exclusion (simplified).
 *
 * Requires primary residence and ownership + use 2 of the last 5 years
 * (here: `years_lived_in >= 2`). Returns excludable gain, capped by status.
 */
export function calcSection121Exclusion(
  is_primary_residence: boolean,
  years_lived_in: number,
  filing_status: string,
  gain: number
): number {
  if (!is_primary_residence || years_lived_in < 2) return 0
  if (gain <= 0) return 0

  const cap =
    filing_status === 'married_joint'
      ? SECTION_121_CAP_MFJ
      : SECTION_121_CAP_SINGLE

  return Math.min(gain, cap)
}
