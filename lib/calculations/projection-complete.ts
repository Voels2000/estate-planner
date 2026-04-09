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
}

export type StateIncomeTaxRate = {
  state_code: string
  rate_pct: number
  tax_year?: number
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
    person1_ss_benefit_62: number | null
    person1_ss_benefit_67: number | null
    has_spouse: boolean
    person2_name: string | null
    person2_birth_year: number | null
    person2_retirement_age: number | null
    person2_ss_claiming_age: number | null
    person2_longevity_age: number | null
    person2_ss_benefit_62: number | null
    person2_ss_benefit_67: number | null
    filing_status: string
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
    inflation_adjust: boolean
    ss_person: string | null
  }[]
  expenses: {
    id: string
    category: string
    amount: number
    start_year: number | null
    end_year: number | null
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
    is_primary_residence: boolean
    owner: string
  }[]
  // State income tax rates from DB — replaces hardcoded STATE_RATES
  state_income_tax_rates?: StateIncomeTaxRate[]
  businesses?: Array<{
    id: string
    name: string
    estimated_value: number
    ownership_pct?: number
    owner?: string
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

// ─── Fallback state income tax rates (used only if DB rates not supplied) ────
// These are approximate flat/top-marginal rates as a safety net.
// The DB (state_income_tax_rates table) is the authoritative source.
const FALLBACK_STATE_RATES: Record<string, number> = {
  AL: 5.0,  AK: 0.0,  AZ: 2.5,  AR: 4.9,  CA: 9.3,  CO: 4.4,
  CT: 6.5,  DE: 6.6,  FL: 0.0,  GA: 5.49, HI: 11.0, ID: 5.8,
  IL: 4.95, IN: 3.15, IA: 6.0,  KS: 5.7,  KY: 4.5,  LA: 4.25,
  ME: 7.15, MD: 5.75, MA: 5.0,  MI: 4.25, MN: 9.85, MS: 5.0,
  MO: 4.8,  MT: 6.5,  NE: 6.64, NV: 0.0,  NH: 0.0,  NJ: 8.97,
  NM: 5.9,  NY: 6.85, NC: 4.99, ND: 2.5,  OH: 4.0,  OK: 4.75,
  OR: 9.9,  PA: 3.07, RI: 5.99, SC: 6.5,  SD: 0.0,  TN: 0.0,
  TX: 0.0,  UT: 4.65, VT: 8.75, VA: 5.75, WA: 0.0,  WV: 6.5,
  WI: 7.65, WY: 0.0,  DC: 8.95,
}

function getStateIncomeTaxRate(
  stateCode: string | null,
  dbRates: StateIncomeTaxRate[] | undefined
): number {
  if (!stateCode) return 0
  const code = stateCode.toUpperCase()
  if (dbRates && dbRates.length > 0) {
    // Use most recent year available in DB
    const stateRows = dbRates
      .filter(r => r.state_code.toUpperCase() === code)
      .sort((a, b) => (b.tax_year ?? 0) - (a.tax_year ?? 0))
    if (stateRows.length > 0) return stateRows[0].rate_pct
  }
  // Fall back to hardcoded rates
  return FALLBACK_STATE_RATES[code] ?? 5.0
}

// ─── Federal Tax Brackets 2024 ────────────────────────────────────────────────

const FEDERAL_BRACKETS_MFJ = [
  { limit: 23200,    rate: 0.10 },
  { limit: 94300,    rate: 0.12 },
  { limit: 201050,   rate: 0.22 },
  { limit: 383900,   rate: 0.24 },
  { limit: 487450,   rate: 0.32 },
  { limit: 731200,   rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
]

const FEDERAL_BRACKETS_SINGLE = [
  { limit: 11600,    rate: 0.10 },
  { limit: 47150,    rate: 0.12 },
  { limit: 100525,   rate: 0.22 },
  { limit: 191950,   rate: 0.24 },
  { limit: 243725,   rate: 0.32 },
  { limit: 609350,   rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
]

const STANDARD_DEDUCTION_MFJ    = 29200
const STANDARD_DEDUCTION_SINGLE = 14600

function calcFederalTax(taxableIncome: number, filingStatus: string): number {
  if (taxableIncome <= 0) return 0
  const brackets  = filingStatus === 'married_joint' ? FEDERAL_BRACKETS_MFJ : FEDERAL_BRACKETS_SINGLE
  const deduction = filingStatus === 'married_joint' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE
  const agi = Math.max(0, taxableIncome - deduction)
  let tax = 0, prev = 0
  for (const bracket of brackets) {
    if (agi <= prev) break
    tax += (Math.min(agi, bracket.limit) - prev) * bracket.rate
    prev = bracket.limit
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
// Now reads from DB rates passed in via input.state_income_tax_rates

function calcStateTax(
  income: number,
  state: string | null,
  dbRates: StateIncomeTaxRate[] | undefined,
  state_secondary?: string | null
): { primary: number; secondary: number } {
  if (income <= 0) return { primary: 0, secondary: 0 }
  const primaryRate   = getStateIncomeTaxRate(state, dbRates) / 100
  const secondaryRate = state_secondary ? getStateIncomeTaxRate(state_secondary, dbRates) / 100 : 0
  return {
    primary:   !state   ? 0 : Math.round(income * primaryRate),
    secondary: !state_secondary ? 0 : Math.round(income * secondaryRate),
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

// ─── Main engine ───────────────────────────────────────────────────────────────

export function computeCompleteProjection(input: CompleteProjectionInput): YearRow[] {
  const { household, assets, liabilities, income, expenses, irmaa_brackets } = input
  const realEstateInput    = input.real_estate ?? []
  const dbStateRates       = input.state_income_tax_rates
  const overrides          = input.overrides ?? {}
  const currentYear        = new Date().getFullYear()
  const businessesInput    = input.businesses ?? []
  const baseBusinessValue  = businessesInput.reduce(
    (sum, b) => sum + Number(b.estimated_value ?? 0) * ((b.ownership_pct ?? 100) / 100),
    0,
  )

  const p1Name      = household.person1_name ?? ''
  const p2Name      = household.has_spouse ? (household.person2_name ?? null) : null
  const p1Birth     = household.person1_birth_year ?? currentYear - 50
  const p1Longevity = household.person1_longevity_age ?? 90
  const endYear     = p1Birth + p1Longevity

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

  // ── Starting real estate ─────────────────────────────────────────────────────
  let re_primary = realEstateInput.filter(r => r.is_primary_residence).reduce((s, r) => s + (r.current_value ?? 0), 0)
  let re_other   = realEstateInput.filter(r => !r.is_primary_residence).reduce((s, r) => s + (r.current_value ?? 0), 0)

  // ── Starting liabilities ─────────────────────────────────────────────────────
  let mortgageBalance = liabilities.filter(l => isMortgageType(l.type)).reduce((s, l) => s + (l.balance ?? 0), 0)
  let otherDebt       = liabilities.filter(l => !isMortgageType(l.type)).reduce((s, l) => s + (l.balance ?? 0), 0)

  const annualMortgagePayment  = liabilities.filter(l => isMortgageType(l.type)).reduce((s, l) => s + (l.monthly_payment ?? 0) * 12, 0)
  const annualOtherDebtPayment = liabilities.filter(l => !isMortgageType(l.type)).reduce((s, l) => s + (l.monthly_payment ?? 0) * 12, 0)
  const avgMortgageRate = (() => {
    const mortgages = liabilities.filter(l => isMortgageType(l.type))
    return mortgages.length > 0
      ? mortgages.reduce((s, l) => s + (l.interest_rate ?? 0), 0) / mortgages.length / 100
      : 0
  })()

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

      const amount = inc.inflation_adjust ? inc.amount * inflationFactor : inc.amount
      const owner  = inc.ss_person?.trim().toLowerCase() ?? ''
      const isP1   = owner === 'person1'
      const isP2   = owner === 'person2'
      const isEarned = ['salary', 'employment', 'self_employment'].includes(inc.source)

      if (isEarned) {
        if (isP1) income_earned_p1 += amount
        else if (isP2) income_earned_p2 += amount
        else income_earned_p1 += amount
      } else {
        if (isP1) income_other_p1 += amount
        else if (isP2) income_other_p2 += amount
        else income_other_pooled += amount
      }
    }

    const income_earned = income_earned_p1 + income_earned_p2
    const income_other  = income_other_p1 + income_other_p2 + income_other_pooled

    // ── Social Security ────────────────────────────────────────────────────────
    const income_ss_person1 = getSsBenefit(
      household.person1_birth_year, p1SsClaimingAge,
      household.person1_ss_benefit_62, household.person1_ss_benefit_67, year
    )
    const income_ss_person2 = household.has_spouse ? getSsBenefit(
      household.person2_birth_year, p2SsClaimingAge,
      household.person2_ss_benefit_62, household.person2_ss_benefit_67, year
    ) : 0

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
    const income_total = income_earned + income_ss_person1 + income_ss_person2 + income_rmd + income_other

    // ── Tax ────────────────────────────────────────────────────────────────────
    const irmaa = calcIrmaa(prevMagi, fs, irmaa_brackets)
    const tax_federal = calcFederalTax(income_total, fs)

    // State tax now uses DB rates via effectiveState (supports scenario overrides)
    const { primary: tax_state, secondary: tax_state_secondary } = calcStateTax(
      income_total, effectiveState, dbStateRates, household.state_secondary
    )

    const deduction              = fs === 'married_joint' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE
    const ordinaryTaxableIncome  = Math.max(0, income_total - deduction)
    const allTaxableGrowth       = poolBucket.taxable * growthRate + p1Bucket.taxable * growthRate + p2Bucket.taxable * growthRate
    const tax_capital_gains      = calcCapitalGainsTax(allTaxableGrowth, ordinaryTaxableIncome, fs)
    const investmentIncome       = income_rmd + allTaxableGrowth + income_other
    const tax_niit               = calcNiit(investmentIncome, income_total, fs)
    const tax_payroll            = calcPayrollTax(income_earned)
    const tax_total              = tax_federal + tax_state + tax_state_secondary + tax_capital_gains + tax_niit + tax_payroll + irmaa.part_b + irmaa.part_d

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

      const amount = exp.inflation_adjust ? exp.amount * inflationFactor : exp.amount
      if (exp.category === 'healthcare' || exp.category === 'medical') {
        expenses_healthcare += amount
      } else {
        expenses_living += amount
      }
    }
    expenses_healthcare += irmaa.part_b + irmaa.part_d
    const expenses_total = expenses_living + expenses_healthcare

    // ── Liabilities paydown ────────────────────────────────────────────────────
    if (mortgageBalance > 0 && annualMortgagePayment > 0) {
      const interest  = mortgageBalance * avgMortgageRate
      const principal = Math.min(mortgageBalance, Math.max(0, annualMortgagePayment - interest))
      mortgageBalance = Math.max(0, mortgageBalance - principal)
    }
    if (otherDebt > 0 && annualOtherDebtPayment > 0) {
      otherDebt = Math.max(0, otherDebt - annualOtherDebtPayment)
    }
    const liabilities_total = mortgageBalance + otherDebt

    // ── Net cash flow & withdrawals ────────────────────────────────────────────
    const net_cash_flow_pre = income_total - tax_total - expenses_total - annualMortgagePayment - annualOtherDebtPayment

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

    re_primary = Math.round(re_primary * (1 + inflationRate))
    re_other   = Math.round(re_other   * (1 + inflationRate))
    const re_total = re_primary + re_other

    const p1Total   = bucketTotal(p1Bucket)
    const p2Total   = bucketTotal(p2Bucket)
    const poolTotal = bucketTotal(poolBucket)
    const assets_total = p1Total + p2Total + poolTotal

    const net_worth = assets_total + re_total + businessValue - liabilities_total

    const estate_excl_home = assets_total + re_other + businessValue - liabilities_total
    const estate_incl_home = assets_total + re_total + businessValue - liabilities_total

    rows.push({
      year,
      age_person1: age1,
      age_person2: age2,
      income_earned:     Math.round(income_earned),
      income_ss_person1: Math.round(income_ss_person1),
      income_ss_person2: Math.round(income_ss_person2),
      income_rmd:        Math.round(income_rmd),
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
      liabilities_mortgage: mortgageBalance,
      liabilities_other:    otherDebt,
      liabilities_total,
      estate_excl_home: Math.round(estate_excl_home),
      estate_incl_home: Math.round(estate_incl_home),
      net_cash_flow: Math.round(net_cash_flow_pre),
      net_worth:     Math.round(net_worth),
    })
  }

  return rows
}
