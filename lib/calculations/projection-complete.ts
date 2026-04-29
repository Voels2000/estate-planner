/**
 * Canonical household projection engine.
 *
 * Produces year-by-year financial outputs (income, taxes, expenses, assets,
 * liabilities, estate snapshots) using admin-managed federal/state tax tables
 * and shared state income tax calculation logic.
 */
import { resolveDeduction } from '@/lib/tax/resolve-deduction'
import {
  calculateStateIncomeTax,
  type StateIncomeTaxBracket as SharedStateIncomeTaxBracket,
} from '@/lib/calculations/stateIncomeTax'

export type YearRow = {
  year: number
  age_person1: number
  age_person2: number | null
  // Income — household
  income_earned: number
  income_ss_person1: number
  income_ss_person2: number
  income_rmd: number
  income_other: number
  income_total: number
  // Income — per person
  income_earned_p1: number
  income_earned_p2: number
  income_rmd_p1: number
  income_rmd_p2: number
  income_other_p1: number
  income_other_p2: number
  income_other_pooled: number
  // Tax
  tax_federal: number
  tax_state: number
  tax_state_secondary: number
  tax_capital_gains: number
  tax_niit: number
  tax_payroll: number
  irmaa_part_b: number
  irmaa_part_d: number
  tax_total: number
  // Expenses
  expenses_living: number
  expenses_healthcare: number
  expenses_total: number
  // Assets — household pooled (joint / unmatched owner)
  assets_tax_deferred: number
  assets_roth: number
  assets_taxable: number
  assets_total: number
  /** Pooled / joint-only total (excludes person1 + person2 explicitly owned) */
  assets_pooled_total: number
  // Assets — Person 1
  assets_p1_tax_deferred: number
  assets_p1_roth: number
  assets_p1_taxable: number
  assets_p1_total: number
  // Assets — Person 2
  assets_p2_tax_deferred: number
  assets_p2_roth: number
  assets_p2_taxable: number
  assets_p2_total: number
  // Real Estate (inflation-grown)
  real_estate_primary: number
  real_estate_other: number
  real_estate_total: number
  // Liabilities
  liabilities_mortgage: number
  liabilities_other: number
  liabilities_total: number
  // Estate Snapshot
  estate_excl_home: number
  estate_incl_home: number
  // Bottom line
  net_cash_flow: number
  net_worth: number
  // RMD tracking
  rmd_required: number        // auto-calculated RMD for the year
  rmd_user_withdrawal: number // sum of user-entered traditional_401k/ira income
  rmd_shortfall: number       // max(0, rmd_required - rmd_user_withdrawal)
  rmd_penalty: number         // rmd_shortfall * 0.25 (IRS 25% excise tax)
}

export type StateIncomeTaxBracket = SharedStateIncomeTaxBracket

export type FederalIncomeTaxBracket = {
  filing_status: string
  min_amount: number
  max_amount: number | null
  rate_pct: number
  tax_year?: number | null
  bracket_order?: number | null
}

export type CompleteProjectionInput = {
  household: {
    id: string
    owner_id: string
    person1_name: string
    person1_birth_year: number | null
    person1_retirement_age: number | null
    person1_ss_claiming_age: number | null
    person1_longevity_age: number | null
    person1_ss_pia?: number | null
    /** @deprecated Prefer person1_ss_pia — kept for legacy rows without PIA */
    person1_ss_benefit_62?: number | null
    /** @deprecated Prefer person1_ss_pia */
    person1_ss_benefit_67?: number | null
    has_spouse: boolean
    person2_name: string | null
    person2_birth_year: number | null
    person2_retirement_age: number | null
    person2_ss_claiming_age: number | null
    person2_longevity_age: number | null
    person2_ss_pia?: number | null
    /** @deprecated Prefer person2_ss_pia */
    person2_ss_benefit_62?: number | null
    /** @deprecated Prefer person2_ss_pia */
    person2_ss_benefit_67?: number | null
    filing_status: string
    deduction_mode?: string | null
    custom_deduction_amount?: number | null
    state_primary: string | null
    state_secondary?: string | null
    inflation_rate: number
    growth_rate_accumulation: number
    growth_rate_retirement: number
  }
  assets: {
    id: string
    type: string
    value: number
    owner: string
  }[]
  liabilities: {
    id: string
    type: string
    balance: number
    monthly_payment: number | null
    interest_rate: number | null
    owner: string
  }[]
  income: {
    id: string
    source: string
    amount: number
    start_year: number | null
    end_year: number | null
    start_month?: number | null
    end_month?: number | null
    inflation_adjust: boolean
    ss_person: string | null
  }[]
  expenses: {
    id: string
    category: string
    amount: number
    start_year: number | null
    end_year: number | null
    start_month?: number | null
    end_month?: number | null
    inflation_adjust: boolean
    owner: string
  }[]
  irmaa_brackets: {
    magi_threshold: number
    part_b_surcharge: number
    part_d_surcharge: number
    filing_status: string
  }[]
  real_estate?: {
    id: string
    name: string
    current_value: number
    mortgage_balance?: number | null
    monthly_payment?: number | null
    interest_rate?: number | null
    is_primary_residence: boolean
    planned_sale_year?: number | null
    selling_costs_pct?: number | null
    owner: string
  }[]
  // Federal income tax brackets from DB (canonical required source)
  federal_income_tax_brackets: FederalIncomeTaxBracket[]
  // Progressive state income tax brackets from DB (preferred when present)
  state_income_tax_brackets?: StateIncomeTaxBracket[]
  businesses?: Array<{
    id: string
    name: string
    estimated_value: number
    owner_estimated_value?: number
    ownership_pct?: number
    owner?: string
  }>
  insurance_policies?: Array<{
    death_benefit: number | null
    cash_value: number | null
    is_ilit: boolean
    is_employer_provided: boolean
  }>
  // Optional overrides — used by Scenarios page to test alternate states / growth rates
  overrides?: {
    state_primary?: string | null
    growth_rate_accumulation?: number
    growth_rate_retirement?: number
    person1_retirement_age?: number
    person1_ss_claiming_age?: number
    person2_retirement_age?: number | null
    person2_ss_claiming_age?: number | null
  }
}

const STANDARD_DEDUCTION_MFJ    = 29200
const STANDARD_DEDUCTION_SINGLE = 14600

function normalizeFederalFilingStatus(filingStatus: string): 'single' | 'mfj' | null {
  const normalized = String(filingStatus ?? '').toLowerCase()
  if (['single', 's', 'mfs', 'married_filing_separately', 'head_of_household', 'hoh'].includes(normalized)) {
    return 'single'
  }
  if (['mfj', 'married_joint', 'married_filing_jointly', 'joint', 'qw', 'qualifying_widow'].includes(normalized)) {
    return 'mfj'
  }
  return null
}

function getFederalBracketsForYear(
  filingStatus: string,
  year: number,
  dbBrackets: FederalIncomeTaxBracket[],
): Array<{ min_amount: number; max_amount: number | null; rate_pct: number }> {
  if (!dbBrackets.length) return []
  const targetFs = normalizeFederalFilingStatus(filingStatus)
  if (!targetFs) return []

  const byStatus = dbBrackets.filter((r) => normalizeFederalFilingStatus(r.filing_status) === targetFs)
  if (!byStatus.length) return []

  const yearRows = byStatus.filter((r) => Number(r.tax_year ?? 0) > 0)
  const selected = yearRows.length
    ? (() => {
        const years = Array.from(new Set(yearRows.map((r) => Number(r.tax_year ?? 0)))).sort((a, b) => a - b)
        const selectedYear = years.filter((y) => y <= year).pop() ?? years[years.length - 1]
        return yearRows.filter((r) => Number(r.tax_year ?? 0) === selectedYear)
      })()
    : byStatus

  return selected
    .slice()
    .sort((a, b) => {
      const minDiff = Number(a.min_amount ?? 0) - Number(b.min_amount ?? 0)
      if (minDiff !== 0) return minDiff
      return Number(a.bracket_order ?? 0) - Number(b.bracket_order ?? 0)
    })
    .map((r) => ({
      min_amount: Number(r.min_amount ?? 0),
      max_amount: r.max_amount == null ? null : Number(r.max_amount),
      rate_pct: Number(r.rate_pct ?? 0),
    }))
}

function calcFederalTax(
  taxableIncome: number,
  filingStatus: string,
  deductionOverride: number | undefined,
  year: number,
  dbBrackets: FederalIncomeTaxBracket[],
): number {
  if (taxableIncome <= 0) return 0
  const deduction = deductionOverride ?? (filingStatus === 'married_joint' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE)
  const agi = Math.max(0, taxableIncome - deduction)
  const dbFederalBracketsForYear = getFederalBracketsForYear(filingStatus, year, dbBrackets)
  if (dbFederalBracketsForYear.length === 0) {
    throw new Error(
      `Missing federal income tax brackets for filing status "${filingStatus}" and year ${year}. ` +
      'Populate federal_tax_brackets before running projections.',
    )
  }

  let tax = 0
  for (const bracket of dbFederalBracketsForYear) {
    const lower = Math.max(0, Number(bracket.min_amount ?? 0))
    const upper = bracket.max_amount == null ? Number.POSITIVE_INFINITY : Number(bracket.max_amount)
    if (agi <= lower) continue
    const taxableInBracket = Math.max(0, Math.min(agi, upper) - lower)
    if (taxableInBracket <= 0) continue
    tax += taxableInBracket * (Number(bracket.rate_pct ?? 0) / 100)
  }
  return Math.round(tax)
}

// ─── Capital Gains ─────────────────────────────────────────────────────────────

const LTCG_LIMIT_0_MFJ    = 94050
const LTCG_LIMIT_15_MFJ   = 583750
const LTCG_LIMIT_0_SINGLE  = 47025
const LTCG_LIMIT_15_SINGLE = 518900

function calcCapitalGainsTax(gains: number, ordinaryIncome: number, filingStatus: string): number {
  if (gains <= 0) return 0
  const isMfj   = filingStatus === 'married_joint'
  const limit0  = isMfj ? LTCG_LIMIT_0_MFJ  : LTCG_LIMIT_0_SINGLE
  const limit15 = isMfj ? LTCG_LIMIT_15_MFJ : LTCG_LIMIT_15_SINGLE
  const room0      = Math.max(0, limit0 - ordinaryIncome)
  const gainsAt0   = Math.min(gains, room0)
  const room15     = Math.max(0, limit15 - Math.max(ordinaryIncome, limit0))
  const gainsAt15  = Math.min(gains - gainsAt0, room15)
  const gainsAt20  = gains - gainsAt0 - gainsAt15
  return Math.round(0.15 * gainsAt15 + 0.2 * gainsAt20)
}

// ─── NIIT ──────────────────────────────────────────────────────────────────────

const NIIT_THRESHOLD_MFJ    = 250000
const NIIT_THRESHOLD_SINGLE = 200000
const NIIT_RATE = 0.038

function calcNiit(investmentIncome: number, magi: number, filingStatus: string): number {
  if (investmentIncome <= 0) return 0
  const threshold = filingStatus === 'married_joint' ? NIIT_THRESHOLD_MFJ : NIIT_THRESHOLD_SINGLE
  const excess    = Math.max(0, magi - threshold)
  return Math.round(Math.min(investmentIncome, excess) * NIIT_RATE)
}

// ─── Payroll Tax ───────────────────────────────────────────────────────────────

const SS_WAGE_BASE_2024 = 168600
const SS_RATE           = 0.062
const MEDICARE_RATE     = 0.0145

function calcPayrollTax(earnedIncome: number): number {
  if (earnedIncome <= 0) return 0
  return Math.round(Math.min(earnedIncome, SS_WAGE_BASE_2024) * SS_RATE + earnedIncome * MEDICARE_RATE)
}

// ─── State Income Tax ─────────────────────────────────────────────────────────
// Uses only progressive state brackets from DB.

function calcStateTax(
  income: number,
  state: string | null,
  year: number,
  dbBrackets: StateIncomeTaxBracket[] | undefined,
  filingStatus: string,
  state_secondary?: string | null
): { primary: number; secondary: number } {
  if (income <= 0) return { primary: 0, secondary: 0 }
  const normalizedFilingStatus: 'single' | 'mfj' =
    filingStatus === 'married_joint' ? 'mfj' : 'single'
  const brackets = dbBrackets ?? []
  const primaryFromBrackets = Math.round(
    calculateStateIncomeTax({
      stateCode: state,
      ordinaryIncome: income,
      filingStatus: normalizedFilingStatus,
      brackets,
      taxYear: year,
    }).stateTax,
  )
  const secondaryFromBrackets = Math.round(
    calculateStateIncomeTax({
      stateCode: state_secondary ?? null,
      ordinaryIncome: income,
      filingStatus: normalizedFilingStatus,
      brackets,
      taxYear: year,
    }).stateTax,
  )
  return {
    // No rows for a state/year => no state income tax for this engine.
    primary: !state ? 0 : primaryFromBrackets,
    secondary: !state_secondary ? 0 : secondaryFromBrackets,
  }
}

// ─── IRMAA ─────────────────────────────────────────────────────────────────────

function calcIrmaa(
  magi: number,
  filingStatus: string,
  brackets: CompleteProjectionInput['irmaa_brackets']
): { part_b: number; part_d: number } {
  const relevant = brackets
    .filter(b => filingStatus === 'married_joint'
      ? b.filing_status === 'married_joint'
      : b.filing_status === 'single')
    .sort((a, b) => a.magi_threshold - b.magi_threshold)

  let part_b = 0, part_d = 0
  for (const bracket of relevant) {
    if (magi > bracket.magi_threshold) {
      part_b = bracket.part_b_surcharge
      part_d = bracket.part_d_surcharge
    }
  }
  const multiplier = filingStatus === 'married_joint' ? 2 : 1
  return {
    part_b: Math.round(part_b * 12 * multiplier),
    part_d: Math.round(part_d * 12 * multiplier),
  }
}

// ─── Social Security ───────────────────────────────────────────────────────────

/** Full Retirement Age (years) from birth year — SSA rules. */
export function getFraFromBirthYear(birthYear: number): number {
  if (birthYear <= 1954) return 66
  if (birthYear >= 1960) return 67
  const extraMonths = (birthYear - 1954) * 2
  return 66 + extraMonths / 12
}

/**
 * Annual SS benefit from monthly PIA (FRA-equivalent) and claiming age.
 */
export function getSsBenefitFromPia(
  pia: number,
  claimAge: number,
  birthYear: number,
): number {
  if (!pia || pia <= 0) return 0

  const fra = getFraFromBirthYear(birthYear)
  const monthsFromFra = Math.round((claimAge - fra) * 12)

  let adjustmentFactor = 1.0

  if (monthsFromFra < 0) {
    const earlyMonths = Math.abs(monthsFromFra)
    const first36 = Math.min(earlyMonths, 36)
    const beyond36 = Math.max(0, earlyMonths - 36)
    adjustmentFactor = 1 - (first36 * (5 / 9)) / 100 - (beyond36 * (5 / 12)) / 100
  } else if (monthsFromFra > 0) {
    const delayedYears = Math.min(monthsFromFra / 12, 70 - fra)
    adjustmentFactor = 1 + delayedYears * 0.08
  }

  const monthlyBenefit = Math.round(pia * adjustmentFactor)
  return monthlyBenefit * 12
}

function getSsBenefit(
  birthYear: number | null,
  claimingAge: number | null,
  benefit62: number | null,
  benefit67: number | null,
  currentYear: number
): number {
  if (!birthYear || !claimingAge) return 0
  if (currentYear < birthYear + claimingAge) return 0
  const b62 = benefit62 ?? 0
  const b67 = benefit67 ?? 0
  if (claimingAge <= 62) return Math.round(b62 * 12)
  if (claimingAge <= 67) {
    const t = (claimingAge - 62) / (67 - 62)
    return Math.round((b62 + t * (b67 - b62)) * 12)
  }
  // Delayed credits: 8% per year above 67, up to age 70
  const delayedYears = Math.min(claimingAge - 67, 3)
  return Math.round(b67 * (1 + 0.08 * delayedYears) * 12)
}

function isRetired(birthYear: number | null, retirementAge: number | null, year: number): boolean {
  if (!birthYear || !retirementAge) return false
  return year >= birthYear + retirementAge
}

// ─── Asset / liability type normalization ────────────────────────────────────

const MORTGAGE_TYPES = new Set([
  'mortgage',
  'home_mortgage',
  'primary_mortgage',
  'heloc',
  'home_equity',
])

const DEFERRED_TYPES = new Set([
  '401k',
  '403b',
  'ira',
  'traditional_ira',
  'retirement_account',
  'pension',
  'sep_ira',
  'simple_ira',
  'traditional_401k',
  'traditional_403b',
  '457',
  'sep',
])

const ROTH_TYPE_SET = new Set(['roth', 'roth_ira', 'roth_401k', 'roth_403b'])

function normalizeLiabilityType(type: string | undefined): string {
  return (type?.toLowerCase().replace(/-/g, '_') ?? '').trim()
}

function isMortgageType(type: string | undefined): boolean {
  return MORTGAGE_TYPES.has(normalizeLiabilityType(type))
}

function normalizeAssetType(type: string | undefined): string {
  return (type?.toLowerCase().replace(/-/g, '_') ?? '').trim()
}

function isTaxDeferredAssetType(type: string | undefined): boolean {
  return DEFERRED_TYPES.has(normalizeAssetType(type))
}

function isRothAssetType(type: string | undefined): boolean {
  return ROTH_TYPE_SET.has(normalizeAssetType(type))
}

type AssetBucket = { taxDeferred: number; roth: number; taxable: number }

function classifyAssets(
  assets: CompleteProjectionInput['assets'],
  matchName: string | null,
  literalKey?: string
): AssetBucket {
  const matched = matchName
    ? assets.filter(a => {
        const owner = a.owner?.trim().toLowerCase() ?? ''
        return owner === matchName.trim().toLowerCase() ||
               (literalKey ? owner === literalKey : false)
      })
    : []
  return {
    taxDeferred: matched.filter(a => isTaxDeferredAssetType(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    roth:        matched.filter(a => isRothAssetType(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    taxable:     matched.filter(a => !isTaxDeferredAssetType(a.type) && !isRothAssetType(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
  }
}

function classifyPooledAssets(
  assets: CompleteProjectionInput['assets'],
  p1Name: string,
  p2Name: string | null
): AssetBucket {
  const pooled = assets.filter(a => {
    const owner = a.owner?.trim().toLowerCase() ?? ''
    const isP1  = owner === p1Name.trim().toLowerCase() || owner === 'person1'
    const isP2  = p2Name ? (owner === p2Name.trim().toLowerCase() || owner === 'person2') : owner === 'person2'
    return !isP1 && !isP2
  })
  return {
    taxDeferred: pooled.filter(a => isTaxDeferredAssetType(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    roth:        pooled.filter(a => isRothAssetType(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    taxable:     pooled.filter(a => !isTaxDeferredAssetType(a.type) && !isRothAssetType(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
  }
}

// ─── RMD ──────────────────────────────────────────────────────────────────────

function getRmdStartAge(birthYear: number): number {
  if (birthYear >= 1960) return 75
  if (birthYear >= 1951) return 73
  return 72
}

function getRmdAmount(age: number, taxDeferredBalance: number, birthYear: number): number {
  const rmdAge = getRmdStartAge(birthYear)
  if (age < rmdAge || taxDeferredBalance <= 0) return 0
  const factor = Math.max(1, 27.4 - (age - 72))
  return Math.round(taxDeferredBalance / factor)
}

// ─── Withdrawal waterfall ──────────────────────────────────────────────────────

function applyWithdrawal(bucket: AssetBucket, needed: number): number {
  let remaining = needed
  const fromTaxable = Math.min(bucket.taxable, remaining)
  bucket.taxable -= fromTaxable
  remaining -= fromTaxable
  if (remaining > 0) {
    const fromDeferred = Math.min(bucket.taxDeferred, remaining)
    bucket.taxDeferred -= fromDeferred
    remaining -= fromDeferred
  }
  if (remaining > 0) {
    const fromRoth = Math.min(bucket.roth, remaining)
    bucket.roth -= fromRoth
    remaining -= fromRoth
  }
  return needed - remaining
}

function growBucket(bucket: AssetBucket, rate: number): void {
  bucket.taxDeferred = Math.round(bucket.taxDeferred * (1 + rate))
  bucket.roth        = Math.round(bucket.roth        * (1 + rate))
  bucket.taxable     = Math.round(bucket.taxable     * (1 + rate))
}

function bucketTotal(bucket: AssetBucket): number {
  return bucket.taxDeferred + bucket.roth + bucket.taxable
}

// ─── Month proration helper ───────────────────────────────────────────────────
// Returns the fraction of the year this income/expense is active.
// null month = full year (no proration). Month 1=Jan, 12=Dec.
// Examples:
//   start_month=12 in start year → 1/12 (only December)
//   end_month=6 in end year → 6/12 (January through June)
//   no months → 1.0 (full year)
function getYearFraction(
  year: number,
  startYear: number | null,
  endYear: number | null,
  startMonth: number | null | undefined,
  endMonth: number | null | undefined
): number {
  let fraction = 1.0
  // Prorate the start year if start_month is set
  if (startYear !== null && year === startYear && startMonth) {
    fraction = Math.min(fraction, (13 - startMonth) / 12)
  }
  // Prorate the end year if end_month is set
  if (endYear !== null && year === endYear && endMonth) {
    fraction = Math.min(fraction, endMonth / 12)
  }
  return Math.max(0, fraction)
}

// ─── Main engine ───────────────────────────────────────────────────────────────

export function computeCompleteProjection(input: CompleteProjectionInput): YearRow[] {
  const { household, assets, liabilities, income, expenses, irmaa_brackets } = input
  const realEstateInput    = input.real_estate ?? []
  const dbFederalBrackets  = input.federal_income_tax_brackets
  const dbStateBrackets    = input.state_income_tax_brackets
  const overrides          = input.overrides ?? {}
  const currentYear        = new Date().getFullYear()
  const businessesInput    = input.businesses ?? []
  const insurancePoliciesInput = input.insurance_policies ?? []
  const baseBusinessValue  = businessesInput.reduce(
    (sum, b) =>
      sum +
      Number(
        b.owner_estimated_value ??
          (Number(b.estimated_value ?? 0) * ((b.ownership_pct ?? 100) / 100)),
      ),
    0,
  )

  const p1Name      = household.person1_name ?? ''
  const p2Name      = household.has_spouse ? (household.person2_name ?? null) : null
  const p1Birth     = household.person1_birth_year ?? currentYear - 50
  const p1Longevity = household.person1_longevity_age ?? 90
  const p2BirthRaw  = household.has_spouse ? (household.person2_birth_year ?? null) : null
  const p2LongevityRaw = household.has_spouse ? (household.person2_longevity_age ?? null) : null
  const endYear = (p2BirthRaw && p2LongevityRaw)
    ? Math.max(p1Birth + p1Longevity, p2BirthRaw + p2LongevityRaw)
    : p1Birth + p1Longevity

  // Apply overrides for scenario comparisons
  const effectiveState       = overrides.state_primary   !== undefined ? overrides.state_primary   : household.state_primary
  const effectiveAccumRate   = (overrides.growth_rate_accumulation ?? household.growth_rate_accumulation ?? 7) / 100
  const effectiveRetireRate  = (overrides.growth_rate_retirement   ?? household.growth_rate_retirement   ?? 5) / 100
  const inflationRate        = (household.inflation_rate ?? 3) / 100

  const p1RetirementAge = overrides.person1_retirement_age ?? household.person1_retirement_age
  const p1SsClaimingAge = overrides.person1_ss_claiming_age ?? household.person1_ss_claiming_age
  const p2RetirementAge = overrides.person2_retirement_age !== undefined
    ? overrides.person2_retirement_age
    : household.person2_retirement_age
  const p2SsClaimingAge = overrides.person2_ss_claiming_age !== undefined
    ? overrides.person2_ss_claiming_age
    : household.person2_ss_claiming_age

  // ── Starting asset buckets ───────────────────────────────────────────────────
  const p1Bucket:   AssetBucket = classifyAssets(assets, p1Name, 'person1')
  const p2Bucket:   AssetBucket = classifyAssets(assets, p2Name, 'person2')
  const poolBucket: AssetBucket = classifyPooledAssets(assets, p1Name, p2Name)

  // ── Per-property mutable state ───────────────────────────────────────────────
  // Each property tracks its own value, mortgage balance, and sold flag
  // so planned_sale_year correctly zeroes them out independently.
  type REState = {
    value: number
    mortgageBalance: number
    annualPayment: number
    mortgageRate: number
    isPrimary: boolean
    saleYear: number | null
    sellingCostsPct: number
    sold: boolean
  }

  const reStates: REState[] = realEstateInput.map(r => ({
    value: r.current_value ?? 0,
    mortgageBalance: r.mortgage_balance ?? 0,
    annualPayment: (r.monthly_payment ?? 0) * 12,
    mortgageRate: r.interest_rate ? r.interest_rate / 100 : 0,
    isPrimary: r.is_primary_residence,
    saleYear: r.planned_sale_year ?? null,
    sellingCostsPct: r.selling_costs_pct ?? 6,
    sold: false,
  }))

  let otherDebt = liabilities.filter(l => !isMortgageType(l.type)).reduce((s, l) => s + (l.balance ?? 0), 0)
  const annualOtherDebtPayment = liabilities.filter(l => !isMortgageType(l.type)).reduce((s, l) => s + (l.monthly_payment ?? 0) * 12, 0)

  // ── Filing status normalisation ──────────────────────────────────────────────
  const fsMap: Record<string, string> = {
    mfj: 'married_joint', married_filing_jointly: 'married_joint',
    mfs: 'single', hoh: 'single', qw: 'married_joint', single: 'single',
  }
  const fs = fsMap[household.filing_status] ?? 'single'

  const rows: YearRow[] = []
  let prevMagi = 0

  for (let year = currentYear; year <= endYear; year++) {
    const yearsFromNow    = year - currentYear
    const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow)
    const businessValue   = Math.round(baseBusinessValue * inflationFactor)
    const insuranceDeathBenefit = insurancePoliciesInput
      .filter(p => !p.is_ilit && p.death_benefit)
      .reduce((s, p) => s + (p.death_benefit ?? 0), 0)
    const insuranceCashValue = insurancePoliciesInput
      .reduce((s, p) => s + (p.cash_value ?? 0), 0)

    const age1 = year - p1Birth
    const age2 = household.has_spouse && household.person2_birth_year
      ? year - household.person2_birth_year
      : null

    const p1Retired  = isRetired(household.person1_birth_year, p1RetirementAge, year)
    const p2Retired  = household.has_spouse
      ? isRetired(household.person2_birth_year, p2RetirementAge, year)
      : true
    const growthRate = p1Retired && p2Retired ? effectiveRetireRate : effectiveAccumRate

    // ── Income ─────────────────────────────────────────────────────────────────
    let income_earned_p1 = 0, income_earned_p2 = 0
    let income_other_p1  = 0, income_other_p2  = 0
    let income_other_pooled = 0

    for (const inc of income) {
      if (inc.start_year && year < inc.start_year) continue
      if (inc.end_year   && year > inc.end_year)   continue
      if (inc.source === 'social_security') continue
      if (['traditional_401k', 'traditional_ira'].includes(inc.source)) continue

      const baseAmount = inc.inflation_adjust ? inc.amount * inflationFactor : inc.amount
      const fraction = getYearFraction(year, inc.start_year, inc.end_year, inc.start_month, inc.end_month)
      const amount = baseAmount * fraction
      const owner  = inc.ss_person?.trim().toLowerCase() ?? ''
      const isP1   = owner === 'person1'
      const isP2   = owner === 'person2'
      const isEarned      = ['salary', 'self_employment', 'equity_awards'].includes(inc.source)
      const isCapGains    = ['capital_gains', 'dividends', 'interest'].includes(inc.source)
      const isRoth        = inc.source === 'roth'
      // Roth withdrawals are tax-free — tracked in income_other but excluded
      // from taxable income later. Tax-deferred withdrawals handled via
      // RMD override logic below. All others are ordinary income.

      if (isEarned) {
        if (isP1) income_earned_p1 += amount
        else if (isP2) income_earned_p2 += amount
        else income_earned_p1 += amount
      } else if (isCapGains) {
        // Routed to income_other for display; taxed at preferential
        // rates via userCapGains calculation in tax section
        if (isP1) income_other_p1 += amount
        else if (isP2) income_other_p2 += amount
        else income_other_pooled += amount
      } else if (isRoth) {
        // Tax-free — included in income display but NOT in taxable income
        // Track separately so we can exclude from tax calculation
        if (isP1) income_other_p1 += amount
        else if (isP2) income_other_p2 += amount
        else income_other_pooled += amount
      } else {
        // salary fallback, pension, business, annuity, rental,
        // inheritance, other — ordinary income
        if (isP1) income_other_p1 += amount
        else if (isP2) income_other_p2 += amount
        else income_other_pooled += amount
      }
    }

    const income_earned = income_earned_p1 + income_earned_p2
    const income_other  = income_other_p1 + income_other_p2 + income_other_pooled

    // ── RMD user withdrawal tracking ──────────────────────────────────────
    // Sum user-entered traditional_401k/ira withdrawals for this year
    const userEnteredTaxDeferred = income
      .filter(inc => ['traditional_401k', 'traditional_ira'].includes(inc.source))
      .filter(inc => !(inc.start_year && year < inc.start_year))
      .filter(inc => !(inc.end_year && year > inc.end_year))
      .reduce((sum, inc) => {
        const amt = inc.inflation_adjust ? inc.amount * inflationFactor : inc.amount
        return sum + amt
      }, 0)

    // Sum user-entered Roth withdrawals for this year (tax-free)
    const userEnteredRoth = income
      .filter(inc => inc.source === 'roth')
      .filter(inc => !(inc.start_year && year < inc.start_year))
      .filter(inc => !(inc.end_year && year > inc.end_year))
      .reduce((sum, inc) => {
        const amt = inc.inflation_adjust ? inc.amount * inflationFactor : inc.amount
        return sum + amt
      }, 0)

    // ── Social Security ────────────────────────────────────────────────────────
    const income_ss_person1 = (() => {
      if (!household.person1_birth_year || !p1SsClaimingAge) return 0
      if (year < household.person1_birth_year + p1SsClaimingAge) return 0
      const pia = household.person1_ss_pia
      if (pia != null && pia > 0) {
        return getSsBenefitFromPia(pia, p1SsClaimingAge, household.person1_birth_year)
      }
      return getSsBenefit(
        household.person1_birth_year,
        p1SsClaimingAge,
        household.person1_ss_benefit_62 ?? null,
        household.person1_ss_benefit_67 ?? null,
        year,
      )
    })()
    const income_ss_person2 = household.has_spouse
      ? (() => {
          if (!household.person2_birth_year || !p2SsClaimingAge) return 0
          if (year < household.person2_birth_year + p2SsClaimingAge) return 0
          const pia = household.person2_ss_pia
          if (pia != null && pia > 0) {
            return getSsBenefitFromPia(pia, p2SsClaimingAge, household.person2_birth_year)
          }
          return getSsBenefit(
            household.person2_birth_year,
            p2SsClaimingAge,
            household.person2_ss_benefit_62 ?? null,
            household.person2_ss_benefit_67 ?? null,
            year,
          )
        })()
      : 0

    // ── RMD ────────────────────────────────────────────────────────────────────
    const p2Age = household.has_spouse && household.person2_birth_year
      ? year - household.person2_birth_year
      : null

    const income_rmd_p1     = getRmdAmount(age1, p1Bucket.taxDeferred, p1Birth)
    const income_rmd_p2     = p2Age !== null ? getRmdAmount(p2Age, p2Bucket.taxDeferred, household.person2_birth_year ?? p1Birth) : 0
    const income_rmd_pooled = getRmdAmount(age1, poolBucket.taxDeferred, p1Birth)

    if (income_rmd_p1 > 0)     { p1Bucket.taxDeferred   = Math.max(0, p1Bucket.taxDeferred   - income_rmd_p1) }
    if (income_rmd_p2 > 0)     { p2Bucket.taxDeferred   = Math.max(0, p2Bucket.taxDeferred   - income_rmd_p2) }
    if (income_rmd_pooled > 0) { poolBucket.taxDeferred = Math.max(0, poolBucket.taxDeferred - income_rmd_pooled) }

    const income_rmd   = income_rmd_p1 + income_rmd_p2 + income_rmd_pooled
    const extraUserWithdrawal = Math.max(0, userEnteredTaxDeferred - income_rmd)
    if (extraUserWithdrawal > 0) {
      const fromPool = Math.min(poolBucket.taxDeferred, extraUserWithdrawal)
      poolBucket.taxDeferred -= fromPool
      let remaining = extraUserWithdrawal - fromPool
      if (remaining > 0) {
        const fromP1 = Math.min(p1Bucket.taxDeferred, remaining)
        p1Bucket.taxDeferred -= fromP1
        remaining -= fromP1
      }
      if (remaining > 0) {
        p2Bucket.taxDeferred = Math.max(0, p2Bucket.taxDeferred - remaining)
      }
    }

    // ── RMD override (Option A) ───────────────────────────────────────────
    // If user has entered manual tax-deferred withdrawals, they override
    // the auto-RMD. The engine always uses the HIGHER of the two so that
    // tax is never understated.
    const autoRmd = income_rmd
    const rmd_user_withdrawal = userEnteredTaxDeferred
    const rmd_required = autoRmd
    const rmd_shortfall = userEnteredTaxDeferred > 0
      ? Math.max(0, autoRmd - userEnteredTaxDeferred)
      : 0
    const rmd_penalty = Math.round(rmd_shortfall * 0.25)

    // Effective RMD used in income = max of auto and user-entered
    // (never let user under-report their taxable withdrawal)
    const effectiveRmd = userEnteredTaxDeferred > 0
      ? Math.max(userEnteredTaxDeferred, autoRmd)
      : autoRmd

    const income_total = income_earned + income_ss_person1 + income_ss_person2 + effectiveRmd + income_other

    // ── Tax ────────────────────────────────────────────────────────────────────
    const irmaa = calcIrmaa(prevMagi, fs, irmaa_brackets)
    const userCapGains =
      income.filter(inc => ['capital_gains', 'dividends', 'interest'].includes(inc.source))
        .filter(inc => !(inc.start_year && year < inc.start_year))
        .filter(inc => !(inc.end_year && year > inc.end_year))
        .reduce((sum, inc) => {
          const amt = inc.inflation_adjust
            ? inc.amount * inflationFactor
            : inc.amount
          return sum + amt
        }, 0)
    const deduction = resolveDeduction(household.deduction_mode, household.custom_deduction_amount, fs)
    // Exclude Roth withdrawals and capital gains from ordinary taxable income
    // Roth = tax-free; cap gains/dividends/interest = preferential rates
    const ordinaryIncome = income_total - userEnteredRoth - userCapGains
    const tax_federal = calcFederalTax(ordinaryIncome, fs, deduction, year, dbFederalBrackets)
    const ordinaryTaxableIncome = Math.max(0, ordinaryIncome - deduction)

    // State tax now uses DB rates via effectiveState (supports scenario overrides)
    const { primary: tax_state, secondary: tax_state_secondary } = calcStateTax(
      ordinaryIncome,
      effectiveState,
      year,
      dbStateBrackets,
      fs,
      household.state_secondary,
    )

    const tax_capital_gains = calcCapitalGainsTax(
      userCapGains,
      ordinaryTaxableIncome,
      fs
    )
    const investmentIncome       = income_rmd + income_other + userCapGains
    const tax_niit               = calcNiit(investmentIncome, income_total, fs)
    const tax_payroll            = calcPayrollTax(income_earned)
    const tax_total              = tax_federal + tax_state + tax_state_secondary +
                    tax_capital_gains + tax_niit + tax_payroll +
                    irmaa.part_b + irmaa.part_d

    prevMagi = income_total

    // ── Expenses ───────────────────────────────────────────────────────────────
    // FIX: Filter expenses by start_year and end_year before summing.
    // Expenses outside their active date range are excluded for this projection year.
    let expenses_living = 0, expenses_healthcare = 0
    for (const exp of expenses) {
      // Skip if this expense hasn't started yet
      if (exp.start_year && year < exp.start_year) continue
      // Skip if this expense has ended
      if (exp.end_year && year > exp.end_year) continue

      const baseAmount = exp.inflation_adjust ? exp.amount * inflationFactor : exp.amount
      const fraction = getYearFraction(year, exp.start_year, exp.end_year, exp.start_month, exp.end_month)
      const amount = baseAmount * fraction
      if (exp.category === 'healthcare' || exp.category === 'medical') {
        expenses_healthcare += amount
      } else {
        expenses_living += amount
      }
    }
    expenses_healthcare += irmaa.part_b + irmaa.part_d
    // Include active mortgage payments in expenses_total so the Lifetime
    // Snapshot expenses column reflects full household cash outflow.
    const annualMortgagePayment = reStates
      .filter(re => !re.sold && re.mortgageBalance > 0)
      .reduce((s, re) => s + re.annualPayment, 0)
    const expenses_total = expenses_living + expenses_healthcare + annualMortgagePayment

    // ── Real estate sales & mortgage paydown ───────────────────────────────────
    let saleProceeds = 0
    for (const re of reStates) {
      if (re.sold) continue

      // Process sale in the planned sale year
      if (re.saleYear !== null && year === re.saleYear) {
        const costs = re.value * (re.sellingCostsPct / 100)
        const proceeds = Math.max(0, re.value - costs - re.mortgageBalance)
        saleProceeds += proceeds
        re.value = 0
        re.mortgageBalance = 0
        re.sold = true
        continue
      }

      // Pay down mortgage for unsold properties
      if (re.mortgageBalance > 0 && re.annualPayment > 0) {
        const interest  = re.mortgageBalance * re.mortgageRate
        const principal = Math.min(re.mortgageBalance, Math.max(0, re.annualPayment - interest))
        re.mortgageBalance = Math.max(0, re.mortgageBalance - principal)
      }
    }

    // Add sale proceeds to pooled taxable assets
    if (saleProceeds > 0) {
      poolBucket.taxable += saleProceeds
    }

    if (otherDebt > 0 && annualOtherDebtPayment > 0) {
      otherDebt = Math.max(0, otherDebt - annualOtherDebtPayment)
    }

    const totalMortgageBalance = reStates.reduce((s, re) => s + re.mortgageBalance, 0)
    const liabilities_total = totalMortgageBalance + otherDebt

    // ── Net cash flow & withdrawals ────────────────────────────────────────────
    // annualMortgagePayment is now inside expenses_total — only subtract other debt here.
    const net_cash_flow_pre = income_total - tax_total - expenses_total - annualOtherDebtPayment

    if (net_cash_flow_pre < 0) {
      const totalTaxable = poolBucket.taxable + p1Bucket.taxable + p2Bucket.taxable
      const shortfall    = Math.abs(net_cash_flow_pre)
      if (totalTaxable > 0) {
        applyWithdrawal(poolBucket, shortfall * (poolBucket.taxable / totalTaxable))
        applyWithdrawal(p1Bucket,   shortfall * (p1Bucket.taxable   / totalTaxable))
        applyWithdrawal(p2Bucket,   shortfall * (p2Bucket.taxable   / totalTaxable))
      } else {
        let rem = shortfall
        rem -= applyWithdrawal(poolBucket, rem)
        rem -= applyWithdrawal(p1Bucket,   rem)
             applyWithdrawal(p2Bucket,   rem)
      }
    } else {
      poolBucket.taxable += net_cash_flow_pre
    }

    growBucket(p1Bucket,   growthRate)
    growBucket(p2Bucket,   growthRate)
    growBucket(poolBucket, growthRate)

    const re_primary = reStates.filter(re => re.isPrimary).reduce((s, re) => s + re.value, 0)
    const re_other   = reStates.filter(re => !re.isPrimary).reduce((s, re) => s + re.value, 0)
    const re_total   = re_primary + re_other

    const p1Total   = bucketTotal(p1Bucket)
    const p2Total   = bucketTotal(p2Bucket)
    const poolTotal = bucketTotal(poolBucket)
    const assets_total = p1Total + p2Total + poolTotal

    // Net worth uses cash value (what you own today if you cashed out)
    const net_worth = assets_total + re_total + businessValue + insuranceCashValue - liabilities_total

    // Gross estate uses death benefit (what transfers at death); liabilities deducted per IRC §2053
    const estate_excl_home = assets_total + re_other + businessValue + insuranceDeathBenefit - liabilities_total
    const estate_incl_home = assets_total + re_total + businessValue + insuranceDeathBenefit - liabilities_total

    rows.push({
      year,
      age_person1: age1,
      age_person2: age2,
      income_earned:     Math.round(income_earned),
      income_ss_person1: Math.round(income_ss_person1),
      income_ss_person2: Math.round(income_ss_person2),
      income_rmd:        Math.round(effectiveRmd),
      income_other:      Math.round(income_other),
      income_total:      Math.round(income_total),
      income_earned_p1:  Math.round(income_earned_p1),
      income_earned_p2:  Math.round(income_earned_p2),
      income_rmd_p1:     Math.round(income_rmd_p1),
      income_rmd_p2:     Math.round(income_rmd_p2),
      income_other_p1:   Math.round(income_other_p1),
      income_other_p2:   Math.round(income_other_p2),
      income_other_pooled: Math.round(income_other_pooled),
      tax_federal:          Math.round(tax_federal),
      tax_state:            Math.round(tax_state),
      tax_state_secondary:  Math.round(tax_state_secondary),
      tax_capital_gains:    Math.round(tax_capital_gains),
      tax_niit:             Math.round(tax_niit),
      tax_payroll:          Math.round(tax_payroll),
      irmaa_part_b:         Math.round(irmaa.part_b),
      irmaa_part_d:         Math.round(irmaa.part_d),
      tax_total:            Math.round(tax_total),
      expenses_living:     Math.round(expenses_living),
      expenses_healthcare: Math.round(expenses_healthcare),
      expenses_total:      Math.round(expenses_total),
      assets_tax_deferred: poolBucket.taxDeferred,
      assets_roth:         poolBucket.roth,
      assets_taxable:      poolBucket.taxable,
      assets_total:        assets_total,
      assets_pooled_total: poolTotal,
      assets_p1_tax_deferred: p1Bucket.taxDeferred,
      assets_p1_roth:         p1Bucket.roth,
      assets_p1_taxable:      p1Bucket.taxable,
      assets_p1_total:        p1Total,
      assets_p2_tax_deferred: p2Bucket.taxDeferred,
      assets_p2_roth:         p2Bucket.roth,
      assets_p2_taxable:      p2Bucket.taxable,
      assets_p2_total:        p2Total,
      real_estate_primary: re_primary,
      real_estate_other:   re_other,
      real_estate_total:   re_total,
      liabilities_mortgage: totalMortgageBalance,
      liabilities_other:    otherDebt,
      liabilities_total,
      estate_excl_home: Math.round(estate_excl_home),
      estate_incl_home: Math.round(estate_incl_home),
      net_cash_flow: Math.round(net_cash_flow_pre),
      net_worth:     Math.round(net_worth),
      rmd_required:        Math.round(rmd_required),
      rmd_user_withdrawal: Math.round(rmd_user_withdrawal),
      rmd_shortfall:       Math.round(rmd_shortfall),
      rmd_penalty:         Math.round(rmd_penalty),
    })

    // Grow real estate values AFTER pushing current year values (skips sold properties)
    for (const re of reStates) {
      if (!re.sold) {
        re.value = Math.round(re.value * (1 + inflationRate))
      }
    }
  }

  return rows
}
