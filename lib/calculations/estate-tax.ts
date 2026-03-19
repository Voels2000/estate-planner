/** Federal + State estate tax, inheritance tax, and §121 helpers. */

export type EstateTaxBracket = {
  min_amount: number
  max_amount: number
  rate_pct: number
}

export const FEDERAL_EXEMPTION_2024 = 13_610_000

// Year-aware federal estate tax exemptions
// 2026: TCJA sunsets — exemption drops back to ~$7M per person
const FEDERAL_EXEMPTIONS_BY_YEAR: Record<number, number> = {
  2024: 13_610_000,
  2025: 13_990_000,
  2026:  7_000_000,  // TCJA sunset estimate — update if legislation changes
}

export function getFederalExemption(taxYear?: number): number {
  if (!taxYear) return FEDERAL_EXEMPTION_2024
  // Use exact year if available, otherwise nearest past year
  const years = Object.keys(FEDERAL_EXEMPTIONS_BY_YEAR).map(Number).sort((a, b) => b - a)
  for (const y of years) {
    if (taxYear >= y) return FEDERAL_EXEMPTIONS_BY_YEAR[y]
  }
  return FEDERAL_EXEMPTION_2024
}

export type FederalEstateTaxResult = {
  taxable_estate: number
  exemption_used: number
  tax_before_credit: number
  applicable_credit: number
  net_estate_tax: number
  gifting_reduction: number
}

function computeProgressiveTaxFromBrackets(
  taxableBase: number,
  brackets: EstateTaxBracket[],
): number {
  if (taxableBase <= 0 || brackets.length === 0) return 0
  const sorted = [...brackets].sort((a, b) => a.min_amount - b.min_amount)
  let tax = 0
  for (const bracket of sorted) {
    const bracketMin = bracket.min_amount
    const bracketMax =
      !Number.isFinite(bracket.max_amount) || bracket.max_amount >= 1e15
        ? Infinity
        : bracket.max_amount
    if (taxableBase <= bracketMin) break
    const taxableInBracket = Math.min(taxableBase, bracketMax) - bracketMin
    if (taxableInBracket > 0) {
      tax += taxableInBracket * (bracket.rate_pct / 100)
    }
  }
  return Math.round(tax * 100) / 100
}

function applicableExemptionAmount(filingStatus: string, taxYear?: number): number {
  const exemption = getFederalExemption(taxYear)
  return filingStatus === 'married_joint' ? exemption * 2 : exemption
}

export function computeFederalEstateTax(
  grossEstate: number,
  liabilities: number,
  trustsExcluded: number,
  filingStatus: string,
  brackets: EstateTaxBracket[],
  annualGifting = 0,
  giftingYears = 1,
  taxYear?: number,
): FederalEstateTaxResult {
  const gifting_reduction = Math.max(0, annualGifting * giftingYears)
  const taxable_estate = Math.max(
    0,
    grossEstate - liabilities - trustsExcluded - gifting_reduction,
  )
  const exemptionCap = applicableExemptionAmount(filingStatus, taxYear)
  const tax_before_credit = computeProgressiveTaxFromBrackets(taxable_estate, brackets)
  const applicable_credit = computeProgressiveTaxFromBrackets(exemptionCap, brackets)
  const net_estate_tax = Math.max(
    0,
    Math.round((tax_before_credit - applicable_credit) * 100) / 100,
  )
  const exemption_used = Math.min(taxable_estate, exemptionCap)
  return {
    taxable_estate,
    exemption_used,
    tax_before_credit,
    applicable_credit,
    net_estate_tax,
    gifting_reduction,
  }
}

export type StateEstateTaxBracket = {
  state: string
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type StateEstateTaxResult = {
  state: string
  state_taxable: number
  state_exemption: number
  state_estate_tax: number
}

export function computeStateEstateTax(
  state: string,
  taxableEstate: number,
  brackets: StateEstateTaxBracket[],
): StateEstateTaxResult {
  const stateRows = brackets.filter((b) => b.state === state)
  if (stateRows.length === 0) {
    return { state, state_taxable: 0, state_exemption: 0, state_estate_tax: 0 }
  }
  const state_exemption = stateRows[0].exemption_amount
  const state_taxable = Math.max(0, taxableEstate - state_exemption)
  const bracketArgs: EstateTaxBracket[] = stateRows.map((r) => ({
    min_amount: r.min_amount,
    max_amount: r.max_amount,
    rate_pct: r.rate_pct,
  }))
  const state_estate_tax = computeProgressiveTaxFromBrackets(state_taxable, bracketArgs)
  return {
    state,
    state_taxable,
    state_exemption,
    state_estate_tax: Math.round(state_estate_tax * 100) / 100,
  }
}

export type BeneficiaryClass = 'spouse' | 'child' | 'sibling' | 'other'

export type StateInheritanceTaxRule = {
  state: string
  beneficiary_class: string
  min_amount: number
  max_amount: number
  rate_pct: number
  exemption_amount: number
}

export type StateInheritanceTaxResult = {
  state: string
  beneficiary_class: BeneficiaryClass
  share_amount: number
  class_exemption: number
  taxable_share: number
  inheritance_tax: number
}

export function computeStateInheritanceTax(
  state: string,
  beneficiaryClass: BeneficiaryClass,
  shareAmount: number,
  rules: StateInheritanceTaxRule[],
): StateInheritanceTaxResult {
  const classRows = rules.filter(
    (r) => r.state === state && r.beneficiary_class === beneficiaryClass,
  )
  if (classRows.length === 0 || shareAmount <= 0) {
    return {
      state,
      beneficiary_class: beneficiaryClass,
      share_amount: shareAmount,
      class_exemption: 0,
      taxable_share: 0,
      inheritance_tax: 0,
    }
  }
  const class_exemption = classRows[0].exemption_amount
  const taxable_share = Math.max(0, shareAmount - class_exemption)
  const bracketArgs: EstateTaxBracket[] = classRows.map((r) => ({
    min_amount: r.min_amount,
    max_amount: r.max_amount,
    rate_pct: r.rate_pct,
  }))
  const inheritance_tax = computeProgressiveTaxFromBrackets(taxable_share, bracketArgs)
  return {
    state,
    beneficiary_class: beneficiaryClass,
    share_amount: shareAmount,
    class_exemption,
    taxable_share,
    inheritance_tax: Math.round(inheritance_tax * 100) / 100,
  }
}

export function computeStateInheritanceTaxTotal(
  state: string,
  shares: Partial<Record<BeneficiaryClass, number>>,
  rules: StateInheritanceTaxRule[],
): { results: StateInheritanceTaxResult[]; total_inheritance_tax: number } {
  const classes: BeneficiaryClass[] = ['spouse', 'child', 'sibling', 'other']
  const results = classes.map((cls) =>
    computeStateInheritanceTax(state, cls, shares[cls] ?? 0, rules),
  )
  const total_inheritance_tax = Math.round(
    results.reduce((s, r) => s + r.inheritance_tax, 0) * 100,
  ) / 100
  return { results, total_inheritance_tax }
}

const SECTION_121_CAP_SINGLE = 250_000
const SECTION_121_CAP_MFJ = 500_000

export function calcSection121Exclusion(
  is_primary_residence: boolean,
  years_lived_in: number,
  filing_status: string,
  gain: number,
): number {
  if (!is_primary_residence || years_lived_in < 2) return 0
  if (gain <= 0) return 0
  const cap =
    filing_status === 'married_joint' ? SECTION_121_CAP_MFJ : SECTION_121_CAP_SINGLE
  return Math.min(gain, cap)
}
