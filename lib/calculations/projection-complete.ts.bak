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
  estate_excl_home: number   // all assets + RE_other - liabilities
  estate_incl_home: number   // estate_excl_home + real_estate_primary
  // Bottom line
  net_cash_flow: number
  net_worth: number
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
    inflation_adjust: boolean
    owner: string
  }[]
  irmaa_brackets: {
    magi_threshold: number
    part_b_surcharge: number
    part_d_surcharge: number
    filing_status: string
  }[]
  // NEW — real estate input for Lifetime Snapshot
  real_estate?: {
    id: string
    name: string
    current_value: number
    is_primary_residence: boolean
    owner: string
  }[]
}

// ─── Federal Tax Brackets 2024 ───────────────────────────────────────────────

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

// ─── Capital Gains ────────────────────────────────────────────────────────────

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

// ─── NIIT ────────────────────────────────────────────────────────────────────

const NIIT_THRESHOLD_MFJ    = 250000
const NIIT_THRESHOLD_SINGLE = 200000
const NIIT_RATE = 0.038

function calcNiit(investmentIncome: number, magi: number, filingStatus: string): number {
  if (investmentIncome <= 0) return 0
  const threshold = filingStatus === 'married_joint' ? NIIT_THRESHOLD_MFJ : NIIT_THRESHOLD_SINGLE
  const excess    = Math.max(0, magi - threshold)
  return Math.round(Math.min(investmentIncome, excess) * NIIT_RATE)
}

// ─── Payroll Tax ──────────────────────────────────────────────────────────────

const SS_WAGE_BASE_2024 = 168600
const SS_RATE           = 0.062
const MEDICARE_RATE     = 0.0145

function calcPayrollTax(earnedIncome: number): number {
  if (earnedIncome <= 0) return 0
  return Math.round(Math.min(earnedIncome, SS_WAGE_BASE_2024) * SS_RATE + earnedIncome * MEDICARE_RATE)
}

// ─── State Tax ────────────────────────────────────────────────────────────────

const STATE_RATES: Record<string, number> = {
  AL: 0.05,  AK: 0.00,  AZ: 0.025, AR: 0.049, CA: 0.093, CO: 0.044,
  CT: 0.065, DE: 0.066, FL: 0.00,  GA: 0.055, HI: 0.11,  ID: 0.058,
  IL: 0.0495,IN: 0.0315,IA: 0.06,  KS: 0.057, KY: 0.045, LA: 0.0425,
  ME: 0.075, MD: 0.0575,MA: 0.05,  MI: 0.0425,MN: 0.0985,MS: 0.05,
  MO: 0.048, MT: 0.065, NE: 0.0664,NV: 0.00,  NH: 0.00,  NJ: 0.0897,
  NM: 0.059, NY: 0.0685,NC: 0.0499,ND: 0.025, OH: 0.04,  OK: 0.0475,
  OR: 0.099, PA: 0.0307,RI: 0.0599,SC: 0.065, SD: 0.00,  TN: 0.00,
  TX: 0.00,  UT: 0.0465,VT: 0.0875,VA: 0.0575,WA: 0.00,  WV: 0.065,
  WI: 0.0765,WY: 0.00,  DC: 0.0895,
}

function calcStateTax(
  income: number,
  state: string | null,
  state_secondary?: string | null
): { primary: number; secondary: number } {
  const primary   = !state || income <= 0 ? 0 : Math.round(income * (STATE_RATES[state.toUpperCase()] ?? 0.05))
  const secondary = !state_secondary || income <= 0 ? 0 : Math.round(income * (STATE_RATES[state_secondary.toUpperCase()] ?? 0.05))
  return { primary, secondary }
}

// ─── IRMAA ────────────────────────────────────────────────────────────────────

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

// ─── Social Security ──────────────────────────────────────────────────────────

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

// ─── Asset type classification ────────────────────────────────────────────────

const TAX_DEFERRED_TYPES = ['traditional_ira', '401k', 'traditional_401k', '403b', 'traditional_403b', '457', 'sep_ira', 'simple_ira', 'pension']
const ROTH_TYPES         = ['roth_ira', 'roth_401k']

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
    taxDeferred: matched.filter(a => TAX_DEFERRED_TYPES.includes(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    roth:        matched.filter(a => ROTH_TYPES.includes(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    taxable:     matched.filter(a => !TAX_DEFERRED_TYPES.includes(a.type) && !ROTH_TYPES.includes(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
  }
}

function classifyPooledAssets(
  assets: CompleteProjectionInput['assets'],
  p1Name: string,
  p2Name: string | null
): AssetBucket {
  // Pooled = everything NOT matching p1 or p2 by name or literal key
  const pooled = assets.filter(a => {
    const owner = a.owner?.trim().toLowerCase() ?? ''
    const isP1  = owner === p1Name.trim().toLowerCase() || owner === 'person1'
    const isP2  = p2Name ? (owner === p2Name.trim().toLowerCase() || owner === 'person2') : owner === 'person2'
    return !isP1 && !isP2
  })
  return {
    taxDeferred: pooled.filter(a => TAX_DEFERRED_TYPES.includes(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    roth:        pooled.filter(a => ROTH_TYPES.includes(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
    taxable:     pooled.filter(a => !TAX_DEFERRED_TYPES.includes(a.type) && !ROTH_TYPES.includes(a.type)).reduce((s, a) => s + (a.value ?? 0), 0),
  }
}

// ─── RMD factor (Uniform Lifetime Table approximation) ───────────────────────

function getRmdStartAge(birthYear: number): number {
  // SECURE Act 2.0: RMD age is 75 for those born 1960+, 73 for 1951-1959
  if (birthYear >= 1960) return 75
  if (birthYear >= 1951) return 73
  return 72 // pre-SECURE Act
}

function getRmdAmount(age: number, taxDeferredBalance: number, birthYear: number): number {
  const rmdAge = getRmdStartAge(birthYear)
  if (age < rmdAge || taxDeferredBalance <= 0) return 0
  const factor = Math.max(1, 27.4 - (age - 72))
  return Math.round(taxDeferredBalance / factor)
}

// ─── Withdrawal waterfall ─────────────────────────────────────────────────────
// Draws from taxable → tax-deferred → roth to cover a shortfall.
// Mutates the bucket object in place; returns actual amount withdrawn.

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

// ─── Main engine ──────────────────────────────────────────────────────────────

export function computeCompleteProjection(input: CompleteProjectionInput): YearRow[] {
  const { household, assets, liabilities, income, expenses, irmaa_brackets } = input
  const realEstateInput = input.real_estate ?? []
  const currentYear = new Date().getFullYear()

  const p1Name      = household.person1_name ?? ''
  const p2Name      = household.has_spouse ? (household.person2_name ?? null) : null
  const p1Birth     = household.person1_birth_year ?? currentYear - 50
  const p1Longevity = household.person1_longevity_age ?? 90
  const endYear     = p1Birth + p1Longevity

  const accumRate    = (household.growth_rate_accumulation ?? 7) / 100
  const retireRate   = (household.growth_rate_retirement   ?? 5) / 100
  const inflationRate = (household.inflation_rate          ?? 3) / 100

  // ── Starting asset buckets (mutable state across loop) ──────────────────────
  const p1Bucket:   AssetBucket = classifyAssets(assets, p1Name, 'person1')
  const p2Bucket:   AssetBucket = classifyAssets(assets, p2Name, 'person2')
  const poolBucket: AssetBucket = classifyPooledAssets(assets, p1Name, p2Name)

  // ── Starting real estate values (grown at inflation each year) ───────────────
  let re_primary = realEstateInput
    .filter(r => r.is_primary_residence)
    .reduce((s, r) => s + (r.current_value ?? 0), 0)
  let re_other = realEstateInput
    .filter(r => !r.is_primary_residence)
    .reduce((s, r) => s + (r.current_value ?? 0), 0)

  // ── Starting liabilities ─────────────────────────────────────────────────────
  let mortgageBalance = liabilities.filter(l => l.type === 'mortgage').reduce((s, l) => s + (l.balance ?? 0), 0)
  let otherDebt       = liabilities.filter(l => l.type !== 'mortgage').reduce((s, l) => s + (l.balance ?? 0), 0)

  const annualMortgagePayment  = liabilities.filter(l => l.type === 'mortgage').reduce((s, l) => s + (l.monthly_payment ?? 0) * 12, 0)
  const annualOtherDebtPayment = liabilities.filter(l => l.type !== 'mortgage').reduce((s, l) => s + (l.monthly_payment ?? 0) * 12, 0)
  const avgMortgageRate = (() => {
    const mortgages = liabilities.filter(l => l.type === 'mortgage')
    return mortgages.length > 0
      ? mortgages.reduce((s, l) => s + (l.interest_rate ?? 0), 0) / mortgages.length / 100
      : 0
  })()

  // ── Filing status normalisation map ──────────────────────────────────────────
  const fsMap: Record<string, string> = {
    mfj: 'married_joint', married_filing_jointly: 'married_joint',
    mfs: 'single', hoh: 'single', qw: 'married_joint', single: 'single',
  }
  const fs = fsMap[household.filing_status] ?? 'single'

  const rows: YearRow[] = []
  let prevMagi = 0

  for (let year = currentYear; year <= endYear; year++) {
    const yearsFromNow   = year - currentYear
    const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow)

    const age1 = year - p1Birth
    const age2 = household.has_spouse && household.person2_birth_year
      ? year - household.person2_birth_year
      : null

    const p1Retired  = isRetired(household.person1_birth_year, household.person1_retirement_age, year)
    const p2Retired  = household.has_spouse
      ? isRetired(household.person2_birth_year, household.person2_retirement_age, year)
      : true
    const growthRate = p1Retired && p2Retired ? retireRate : accumRate

    // ── Income ────────────────────────────────────────────────────────────────
    let income_earned_p1 = 0, income_earned_p2 = 0
    let income_other_p1  = 0, income_other_p2  = 0
    let income_other_pooled = 0

    for (const inc of income) {
      if (inc.start_year && year < inc.start_year) continue
      if (inc.end_year   && year > inc.end_year)   continue
      if (inc.source === 'social_security') continue   // handled via getSsBenefit()

      const amount = inc.inflation_adjust ? inc.amount * inflationFactor : inc.amount
      const owner  = inc.ss_person?.trim().toLowerCase() ?? ''
      const isP1   = owner === 'person1'
      const isP2   = owner === 'person2'

      const isEarned = ['salary', 'employment', 'self_employment'].includes(inc.source)

      if (isEarned) {
        if (isP1) income_earned_p1 += amount
        else if (isP2) income_earned_p2 += amount
        else income_earned_p1 += amount  // unmatched earned → p1 (conservative default)
      } else {
        if (isP1) income_other_p1 += amount
        else if (isP2) income_other_p2 += amount
        else income_other_pooled += amount
      }
    }

    const income_earned = income_earned_p1 + income_earned_p2
    const income_other  = income_other_p1 + income_other_p2 + income_other_pooled

    // ── Social Security ───────────────────────────────────────────────────────
    const income_ss_person1 = getSsBenefit(
      household.person1_birth_year, household.person1_ss_claiming_age,
      household.person1_ss_benefit_62, household.person1_ss_benefit_67, year
    )
    const income_ss_person2 = household.has_spouse ? getSsBenefit(
      household.person2_birth_year, household.person2_ss_claiming_age,
      household.person2_ss_benefit_62, household.person2_ss_benefit_67, year
    ) : 0

    // ── RMD — per person then pooled ──────────────────────────────────────────
    const p2Age = household.has_spouse && household.person2_birth_year
      ? year - household.person2_birth_year
      : null

    const income_rmd_p1 = getRmdAmount(age1, p1Bucket.taxDeferred, p1Birth)
    const income_rmd_p2 = p2Age !== null ? getRmdAmount(p2Age, p2Bucket.taxDeferred, household.person2_birth_year ?? p1Birth) : 0
    const income_rmd_pooled = getRmdAmount(age1, poolBucket.taxDeferred, p1Birth)  // use p1 birth for pooled

    // Force RMD withdrawals out of each bucket
    if (income_rmd_p1 > 0)     { p1Bucket.taxDeferred   = Math.max(0, p1Bucket.taxDeferred   - income_rmd_p1) }
    if (income_rmd_p2 > 0)     { p2Bucket.taxDeferred   = Math.max(0, p2Bucket.taxDeferred   - income_rmd_p2) }
    if (income_rmd_pooled > 0) { poolBucket.taxDeferred = Math.max(0, poolBucket.taxDeferred - income_rmd_pooled) }

    const income_rmd = income_rmd_p1 + income_rmd_p2 + income_rmd_pooled

    const income_total = income_earned + income_ss_person1 + income_ss_person2 + income_rmd + income_other

    // ── Tax ───────────────────────────────────────────────────────────────────
    const irmaa = calcIrmaa(prevMagi, fs, irmaa_brackets)
    const tax_federal = calcFederalTax(income_total, fs)
    const { primary: tax_state, secondary: tax_state_secondary } = calcStateTax(
      income_total, household.state_primary, household.state_secondary
    )
    const deduction = fs === 'married_joint' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE
    const ordinaryTaxableIncome  = Math.max(0, income_total - deduction)
    const allTaxableGrowth       = poolBucket.taxable * growthRate + p1Bucket.taxable * growthRate + p2Bucket.taxable * growthRate
    const tax_capital_gains      = calcCapitalGainsTax(allTaxableGrowth, ordinaryTaxableIncome, fs)
    const investmentIncome       = income_rmd + allTaxableGrowth + income_other
    const tax_niit               = calcNiit(investmentIncome, income_total, fs)
    const tax_payroll            = calcPayrollTax(income_earned)
    const tax_total              = tax_federal + tax_state + tax_state_secondary + tax_capital_gains + tax_niit + tax_payroll + irmaa.part_b + irmaa.part_d

    prevMagi = income_total

    // ── Expenses ──────────────────────────────────────────────────────────────
    let expenses_living = 0, expenses_healthcare = 0
    for (const exp of expenses) {
      const amount = exp.inflation_adjust ? exp.amount * inflationFactor : exp.amount
      if (exp.category === 'healthcare' || exp.category === 'medical') {
        expenses_healthcare += amount
      } else {
        expenses_living += amount
      }
    }
    expenses_healthcare += irmaa.part_b + irmaa.part_d
    const expenses_total = expenses_living + expenses_healthcare

    // ── Liabilities paydown ───────────────────────────────────────────────────
    if (mortgageBalance > 0 && annualMortgagePayment > 0) {
      const interest  = mortgageBalance * avgMortgageRate
      const principal = Math.min(mortgageBalance, Math.max(0, annualMortgagePayment - interest))
      mortgageBalance = Math.max(0, mortgageBalance - principal)
    }
    if (otherDebt > 0 && annualOtherDebtPayment > 0) {
      otherDebt = Math.max(0, otherDebt - annualOtherDebtPayment)
    }
    const liabilities_total = mortgageBalance + otherDebt

    // ── Net cash flow & withdrawals ───────────────────────────────────────────
    const net_cash_flow_pre = income_total - tax_total - expenses_total - annualMortgagePayment - annualOtherDebtPayment

    if (net_cash_flow_pre < 0) {
      // Draw proportionally from each bucket based on their taxable balance
      const totalTaxable = poolBucket.taxable + p1Bucket.taxable + p2Bucket.taxable
      const shortfall    = Math.abs(net_cash_flow_pre)
      if (totalTaxable > 0) {
        applyWithdrawal(poolBucket, shortfall * (poolBucket.taxable / totalTaxable))
        applyWithdrawal(p1Bucket,   shortfall * (p1Bucket.taxable   / totalTaxable))
        applyWithdrawal(p2Bucket,   shortfall * (p2Bucket.taxable   / totalTaxable))
      } else {
        // Waterfall: pool → p1 → p2
        let rem = shortfall
        rem -= applyWithdrawal(poolBucket, rem)
        rem -= applyWithdrawal(p1Bucket,   rem)
             applyWithdrawal(p2Bucket,   rem)
      }
    } else {
      // Surplus: park in pooled taxable
      poolBucket.taxable += net_cash_flow_pre
    }

    // ── Grow all buckets (investment rate) ────────────────────────────────────
    growBucket(p1Bucket,   growthRate)
    growBucket(p2Bucket,   growthRate)
    growBucket(poolBucket, growthRate)

    // ── Grow real estate (inflation rate) ────────────────────────────────────
    re_primary = Math.round(re_primary * (1 + inflationRate))
    re_other   = Math.round(re_other   * (1 + inflationRate))
    const re_total = re_primary + re_other

    // ── Asset totals ──────────────────────────────────────────────────────────
    const p1Total   = bucketTotal(p1Bucket)
    const p2Total   = bucketTotal(p2Bucket)
    const poolTotal = bucketTotal(poolBucket)
    const assets_total = p1Total + p2Total + poolTotal

    const net_worth = assets_total + re_total - liabilities_total

    // ── Estate snapshot ───────────────────────────────────────────────────────
    const estate_excl_home = assets_total + re_other   - liabilities_total
    const estate_incl_home = assets_total + re_total   - liabilities_total

    const net_cash_flow = Math.round(net_cash_flow_pre)

    rows.push({
      year,
      age_person1: age1,
      age_person2: age2,

      // Income — household
      income_earned:     Math.round(income_earned),
      income_ss_person1: Math.round(income_ss_person1),
      income_ss_person2: Math.round(income_ss_person2),
      income_rmd:        Math.round(income_rmd),
      income_other:      Math.round(income_other),
      income_total:      Math.round(income_total),

      // Income — per person
      income_earned_p1:  Math.round(income_earned_p1),
      income_earned_p2:  Math.round(income_earned_p2),
      income_rmd_p1:     Math.round(income_rmd_p1),
      income_rmd_p2:     Math.round(income_rmd_p2),
      income_other_p1:   Math.round(income_other_p1),
      income_other_p2:   Math.round(income_other_p2),
      income_other_pooled: Math.round(income_other_pooled),

      // Tax
      tax_federal:          Math.round(tax_federal),
      tax_state:            Math.round(tax_state),
      tax_state_secondary:  Math.round(tax_state_secondary),
      tax_capital_gains:    Math.round(tax_capital_gains),
      tax_niit:             Math.round(tax_niit),
      tax_payroll:          Math.round(tax_payroll),
      irmaa_part_b:         Math.round(irmaa.part_b),
      irmaa_part_d:         Math.round(irmaa.part_d),
      tax_total:            Math.round(tax_total),

      // Expenses
      expenses_living:     Math.round(expenses_living),
      expenses_healthcare: Math.round(expenses_healthcare),
      expenses_total:      Math.round(expenses_total),

      // Assets — household pooled (joint / unmatched)
      assets_tax_deferred: poolBucket.taxDeferred,
      assets_roth:         poolBucket.roth,
      assets_taxable:      poolBucket.taxable,
      assets_total:        poolTotal,   // pooled subtotal (backward compat label, now excludes p1/p2)

      // Assets — Person 1
      assets_p1_tax_deferred: p1Bucket.taxDeferred,
      assets_p1_roth:         p1Bucket.roth,
      assets_p1_taxable:      p1Bucket.taxable,
      assets_p1_total:        p1Total,

      // Assets — Person 2
      assets_p2_tax_deferred: p2Bucket.taxDeferred,
      assets_p2_roth:         p2Bucket.roth,
      assets_p2_taxable:      p2Bucket.taxable,
      assets_p2_total:        p2Total,

      // Real estate (inflation-grown)
      real_estate_primary: re_primary,
      real_estate_other:   re_other,
      real_estate_total:   re_total,

      // Liabilities
      liabilities_mortgage: Math.round(mortgageBalance),
      liabilities_other:    Math.round(otherDebt),
      liabilities_total:    Math.round(liabilities_total),

      // Estate snapshot
      estate_excl_home: Math.round(estate_excl_home),
      estate_incl_home: Math.round(estate_incl_home),

      // Bottom line
      net_cash_flow,
      net_worth: Math.round(net_worth),
    })
  }

  return rows
}
