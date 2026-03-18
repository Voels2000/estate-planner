export type YearRow = {
  year: number
  age_person1: number
  age_person2: number | null
  // Income
  income_earned: number
  income_ss_person1: number
  income_ss_person2: number
  income_rmd: number
  income_other: number
  income_total: number
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
  // Assets
  assets_tax_deferred: number
  assets_roth: number
  assets_taxable: number
  assets_total: number
  // Liabilities
  liabilities_mortgage: number
  liabilities_other: number
  liabilities_total: number
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
    owner: string
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
}

// Federal tax brackets 2024 (MFJ and Single)
const FEDERAL_BRACKETS_MFJ = [
  { limit: 23200,   rate: 0.10 },
  { limit: 94300,   rate: 0.12 },
  { limit: 201050,  rate: 0.22 },
  { limit: 383900,  rate: 0.24 },
  { limit: 487450,  rate: 0.32 },
  { limit: 731200,  rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
]

const FEDERAL_BRACKETS_SINGLE = [
  { limit: 11600,   rate: 0.10 },
  { limit: 47150,   rate: 0.12 },
  { limit: 100525,  rate: 0.22 },
  { limit: 191950,  rate: 0.24 },
  { limit: 243725,  rate: 0.32 },
  { limit: 609350,  rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
]

const STANDARD_DEDUCTION_MFJ = 29200
const STANDARD_DEDUCTION_SINGLE = 14600

function calcFederalTax(taxableIncome: number, filingStatus: string): number {
  if (taxableIncome <= 0) return 0
  const brackets = filingStatus === 'married_joint'
    ? FEDERAL_BRACKETS_MFJ
    : FEDERAL_BRACKETS_SINGLE
  const deduction = filingStatus === 'married_joint'
    ? STANDARD_DEDUCTION_MFJ
    : STANDARD_DEDUCTION_SINGLE
  const agi = Math.max(0, taxableIncome - deduction)
  let tax = 0
  let prev = 0
  for (const bracket of brackets) {
    if (agi <= prev) break
    const taxable = Math.min(agi, bracket.limit) - prev
    tax += taxable * bracket.rate
    prev = bracket.limit
  }
  return Math.round(tax)
}

// 2024 long-term capital gains brackets (0%, 15%, 20%)
const LTCG_LIMIT_0_MFJ = 94050
const LTCG_LIMIT_15_MFJ = 583750
const LTCG_LIMIT_0_SINGLE = 47025
const LTCG_LIMIT_15_SINGLE = 518900

function calcCapitalGainsTax(gains: number, ordinaryIncome: number, filingStatus: string): number {
  if (gains <= 0) return 0
  const isMfj = filingStatus === 'married_joint'
  const limit0 = isMfj ? LTCG_LIMIT_0_MFJ : LTCG_LIMIT_0_SINGLE
  const limit15 = isMfj ? LTCG_LIMIT_15_MFJ : LTCG_LIMIT_15_SINGLE
  const room0 = Math.max(0, limit0 - ordinaryIncome)
  const gainsAt0 = Math.min(gains, room0)
  const room15 = Math.max(0, limit15 - Math.max(ordinaryIncome, limit0))
  const gainsAt15 = Math.min(gains - gainsAt0, room15)
  const gainsAt20 = gains - gainsAt0 - gainsAt15
  return Math.round(0.15 * gainsAt15 + 0.2 * gainsAt20)
}

const NIIT_THRESHOLD_MFJ = 250000
const NIIT_THRESHOLD_SINGLE = 200000
const NIIT_RATE = 0.038

function calcNiit(investmentIncome: number, magi: number, filingStatus: string): number {
  if (investmentIncome <= 0) return 0
  const threshold = filingStatus === 'married_joint' ? NIIT_THRESHOLD_MFJ : NIIT_THRESHOLD_SINGLE
  const excess = Math.max(0, magi - threshold)
  const taxable = Math.min(investmentIncome, excess)
  return Math.round(taxable * NIIT_RATE)
}

const SS_WAGE_BASE_2024 = 168600
const SS_RATE = 0.062
const MEDICARE_RATE = 0.0145

function calcPayrollTax(earnedIncome: number): number {
  if (earnedIncome <= 0) return 0
  const ssTaxable = Math.min(earnedIncome, SS_WAGE_BASE_2024)
  return Math.round(ssTaxable * SS_RATE + earnedIncome * MEDICARE_RATE)
}

function calcStateTax(
  income: number,
  state: string | null,
  state_secondary?: string | null
): { primary: number; secondary: number } {
  const rates: Record<string, number> = {
    AL: 0.05, AK: 0.00, AZ: 0.025, AR: 0.049, CA: 0.093, CO: 0.044,
    CT: 0.065, DE: 0.066, FL: 0.00, GA: 0.055, HI: 0.11, ID: 0.058,
    IL: 0.0495, IN: 0.0315, IA: 0.06, KS: 0.057, KY: 0.045, LA: 0.0425,
    ME: 0.075, MD: 0.0575, MA: 0.05, MI: 0.0425, MN: 0.0985, MS: 0.05,
    MO: 0.048, MT: 0.065, NE: 0.0664, NV: 0.00, NH: 0.00, NJ: 0.0897,
    NM: 0.059, NY: 0.0685, NC: 0.0499, ND: 0.025, OH: 0.04, OK: 0.0475,
    OR: 0.099, PA: 0.0307, RI: 0.0599, SC: 0.065, SD: 0.00, TN: 0.00,
    TX: 0.00, UT: 0.0465, VT: 0.0875, VA: 0.0575, WA: 0.00, WV: 0.065,
    WI: 0.0765, WY: 0.00, DC: 0.0895,
  }
  const primary = !state || income <= 0 ? 0 : Math.round(income * (rates[state.toUpperCase()] ?? 0.05))
  const secondary = !state_secondary || income <= 0 ? 0 : Math.round(income * (rates[state_secondary.toUpperCase()] ?? 0.05))
  return { primary, secondary }
}

function calcIrmaa(
  magi: number,
  filingStatus: string,
  brackets: CompleteProjectionInput['irmaa_brackets']
): { part_b: number; part_d: number } {
  const relevant = brackets
    .filter(b => b.filing_status === filingStatus || b.filing_status === 'single')
    .filter(b => filingStatus === 'married_joint'
      ? b.filing_status === 'married_joint'
      : b.filing_status === 'single')
    .sort((a, b) => a.magi_threshold - b.magi_threshold)

  let part_b = 0
  let part_d = 0
  for (const bracket of relevant) {
    if (magi > bracket.magi_threshold) {
      part_b = bracket.part_b_surcharge
      part_d = bracket.part_d_surcharge
    }
  }
  // IRMAA is per-person for MFJ — multiply by 2 if married
  const multiplier = filingStatus === 'married_joint' ? 2 : 1
  return {
    part_b: Math.round(part_b * 12 * multiplier),  // annual
    part_d: Math.round(part_d * 12 * multiplier),
  }
}

function getSsBenefit(
  birthYear: number | null,
  claimingAge: number | null,
  benefit62: number | null,
  benefit67: number | null,
  currentYear: number
): number {
  if (!birthYear || !claimingAge) return 0
  const claimYear = birthYear + claimingAge
  if (currentYear < claimYear) return 0
  // Interpolate between 62 and 67 benefit
  const b62 = benefit62 ?? 0
  const b67 = benefit67 ?? 0
  if (claimingAge <= 62) return b62 * 12
  if (claimingAge >= 67) return b67 * 12
  const t = (claimingAge - 62) / (67 - 62)
  return Math.round((b62 + t * (b67 - b62)) * 12)
}

function isRetired(birthYear: number | null, retirementAge: number | null, year: number): boolean {
  if (!birthYear || !retirementAge) return false
  return year >= birthYear + retirementAge
}

const TAX_DEFERRED_TYPES = ['traditional_ira', '401k', '403b', '457', 'sep_ira', 'simple_ira', 'pension']
const ROTH_TYPES = ['roth_ira', 'roth_401k']

export function computeCompleteProjection(input: CompleteProjectionInput): YearRow[] {
  const { household, assets, liabilities, income, expenses, irmaa_brackets } = input
  const currentYear = new Date().getFullYear()

  const p1Birth = household.person1_birth_year ?? currentYear - 50
  const p1Longevity = household.person1_longevity_age ?? 90
  const endYear = p1Birth + p1Longevity

  // Grow rates as decimals
  const accumRate = (household.growth_rate_accumulation ?? 7) / 100
  const retireRate = (household.growth_rate_retirement ?? 5) / 100
  const inflationRate = (household.inflation_rate ?? 3) / 100

  // Starting asset buckets
  let taxDeferred = assets
    .filter(a => TAX_DEFERRED_TYPES.includes(a.type))
    .reduce((sum, a) => sum + (a.value ?? 0), 0)
  let rothAssets = assets
    .filter(a => ROTH_TYPES.includes(a.type))
    .reduce((sum, a) => sum + (a.value ?? 0), 0)
  let taxable = assets
    .filter(a => !TAX_DEFERRED_TYPES.includes(a.type) && !ROTH_TYPES.includes(a.type))
    .reduce((sum, a) => sum + (a.value ?? 0), 0)

  // Starting liability buckets
  let mortgageBalance = liabilities
    .filter(l => l.type === 'mortgage')
    .reduce((sum, l) => sum + (l.balance ?? 0), 0)
  let otherDebt = liabilities
    .filter(l => l.type !== 'mortgage')
    .reduce((sum, l) => sum + (l.balance ?? 0), 0)

  // Annual mortgage payment (all mortgages combined)
  const annualMortgagePayment = liabilities
    .filter(l => l.type === 'mortgage')
    .reduce((sum, l) => sum + ((l.monthly_payment ?? 0) * 12), 0)
  const avgMortgageRate = liabilities.filter(l => l.type === 'mortgage').length > 0
    ? liabilities.filter(l => l.type === 'mortgage')
        .reduce((sum, l) => sum + (l.interest_rate ?? 0), 0) /
      liabilities.filter(l => l.type === 'mortgage').length / 100
    : 0

  const annualOtherDebtPayment = liabilities
    .filter(l => l.type !== 'mortgage')
    .reduce((sum, l) => sum + ((l.monthly_payment ?? 0) * 12), 0)

  const rows: YearRow[] = []
  let prevMagi = 0 // IRMAA uses prior year MAGI

  for (let year = currentYear; year <= endYear; year++) {
    const yearsFromNow = year - currentYear
    const inflationFactor = Math.pow(1 + inflationRate, yearsFromNow)

    const age1 = year - p1Birth
    const age2 = household.has_spouse && household.person2_birth_year
      ? year - household.person2_birth_year
      : null

    const p1Retired = isRetired(household.person1_birth_year, household.person1_retirement_age, year)
    const p2Retired = household.has_spouse
      ? isRetired(household.person2_birth_year, household.person2_retirement_age, year)
      : true

    const bothRetired = p1Retired && p2Retired
    const growthRate = bothRetired ? retireRate : accumRate

    // --- INCOME ---
    let income_earned = 0
    let income_other = 0
    for (const inc of income) {
      if (inc.start_year && year < inc.start_year) continue
      if (inc.end_year && year > inc.end_year) continue
      const amount = inc.inflation_adjust
        ? inc.amount * inflationFactor
        : inc.amount
      if (inc.source === 'employment' || inc.source === 'self_employment') {
        income_earned += amount
      } else {
        income_other += amount
      }
    }

    const income_ss_person1 = getSsBenefit(
      household.person1_birth_year,
      household.person1_ss_claiming_age,
      household.person1_ss_benefit_62,
      household.person1_ss_benefit_67,
      year
    )
    const income_ss_person2 = household.has_spouse ? getSsBenefit(
      household.person2_birth_year,
      household.person2_ss_claiming_age,
      household.person2_ss_benefit_62,
      household.person2_ss_benefit_67,
      year
    ) : 0

    // RMD (simplified — full engine in rmd.ts; here we use a flat factor)
    let income_rmd = 0
    if (age1 >= 73 && taxDeferred > 0) {
      const rmdFactor = Math.max(1, 27.4 - (age1 - 72))  // Uniform table approximation
      income_rmd = Math.round(taxDeferred / rmdFactor)
    }

    const income_total = income_earned + income_ss_person1 + income_ss_person2 + income_rmd + income_other

    // --- TAX ---
    // Normalize filing status short codes to internal format
    const fsMap: Record<string, string> = { mfj: 'married_joint', married_filing_jointly: 'married_joint', mfs: 'single', hoh: 'single', qw: 'married_joint', single: 'single' }
    const fs = fsMap[household.filing_status] ?? 'single'
    // MAGI for IRMAA uses PRIOR year
    const irmaa = calcIrmaa(prevMagi, fs, irmaa_brackets)
    const tax_federal = calcFederalTax(income_total, fs)
    const { primary: tax_state, secondary: tax_state_secondary } = calcStateTax(
      income_total,
      household.state_primary,
      household.state_secondary
    )
    const deduction = fs === 'married_joint' ? STANDARD_DEDUCTION_MFJ : STANDARD_DEDUCTION_SINGLE
    const ordinaryTaxableIncome = Math.max(0, income_total - deduction)
    const taxableBrokerageGrowth = taxable * growthRate
    const tax_capital_gains = calcCapitalGainsTax(taxableBrokerageGrowth, ordinaryTaxableIncome, fs)
    const investmentIncome = income_rmd + taxableBrokerageGrowth + income_other
    const tax_niit = calcNiit(investmentIncome, income_total, fs)
    const tax_payroll = calcPayrollTax(income_earned)
    const tax_total = tax_federal + tax_state + tax_state_secondary + tax_capital_gains + tax_niit + tax_payroll + irmaa.part_b + irmaa.part_d

    // Store this year's income as next year's MAGI
    prevMagi = income_total

    // --- EXPENSES ---
    let expenses_living = 0
    let expenses_healthcare = 0
    for (const exp of expenses) {
      const amount = exp.inflation_adjust
        ? exp.amount * inflationFactor
        : exp.amount
      if (exp.category === 'healthcare' || exp.category === 'medical') {
        expenses_healthcare += amount
      } else {
        expenses_living += amount
      }
    }
    // Add IRMAA into healthcare
    expenses_healthcare += irmaa.part_b + irmaa.part_d
    const expenses_total = expenses_living + expenses_healthcare

    // --- LIABILITIES ---
    // Pay down mortgage
    if (mortgageBalance > 0 && annualMortgagePayment > 0) {
      const interest = mortgageBalance * avgMortgageRate
      const principal = Math.min(mortgageBalance, Math.max(0, annualMortgagePayment - interest))
      mortgageBalance = Math.max(0, mortgageBalance - principal)
    }
    // Pay down other debt (simple: reduce by payment amount)
    if (otherDebt > 0 && annualOtherDebtPayment > 0) {
      otherDebt = Math.max(0, otherDebt - annualOtherDebtPayment)
    }
    const liabilities_total = mortgageBalance + otherDebt

    // --- NET CASH FLOW ---
    const net_cash_flow = income_total - tax_total - expenses_total - annualMortgagePayment - annualOtherDebtPayment

    // --- GROW ASSETS ---
    // Withdraw from taxable first if cash flow negative
    let withdrawal = 0
    if (net_cash_flow < 0) {
      withdrawal = Math.abs(net_cash_flow)
      if (taxable >= withdrawal) {
        taxable -= withdrawal
        withdrawal = 0
      } else {
        withdrawal -= taxable
        taxable = 0
        if (taxDeferred >= withdrawal) {
          taxDeferred -= withdrawal
          withdrawal = 0
        } else {
          withdrawal -= taxDeferred
          taxDeferred = 0
          rothAssets = Math.max(0, rothAssets - withdrawal)
        }
      }
    } else {
      // Add surplus to taxable
      taxable += net_cash_flow
    }

    // Apply growth
    taxDeferred = Math.round(taxDeferred * (1 + growthRate))
    rothAssets = Math.round(rothAssets * (1 + growthRate))
    taxable = Math.round(taxable * (1 + growthRate))

    const assets_total = taxDeferred + rothAssets + taxable
    const net_worth = assets_total - liabilities_total

    rows.push({
      year,
      age_person1: age1,
      age_person2: age2,
      income_earned: Math.round(income_earned),
      income_ss_person1: Math.round(income_ss_person1),
      income_ss_person2: Math.round(income_ss_person2),
      income_rmd: Math.round(income_rmd),
      income_other: Math.round(income_other),
      income_total: Math.round(income_total),
      tax_federal: Math.round(tax_federal),
      tax_state: Math.round(tax_state),
      tax_state_secondary: Math.round(tax_state_secondary),
      tax_capital_gains: Math.round(tax_capital_gains),
      tax_niit: Math.round(tax_niit),
      tax_payroll: Math.round(tax_payroll),
      irmaa_part_b: Math.round(irmaa.part_b),
      irmaa_part_d: Math.round(irmaa.part_d),
      tax_total: Math.round(tax_total),
      expenses_living: Math.round(expenses_living),
      expenses_healthcare: Math.round(expenses_healthcare),
      expenses_total: Math.round(expenses_total),
      assets_tax_deferred: taxDeferred,
      assets_roth: rothAssets,
      assets_taxable: taxable,
      assets_total,
      liabilities_mortgage: Math.round(mortgageBalance),
      liabilities_other: Math.round(otherDebt),
      liabilities_total: Math.round(liabilities_total),
      net_cash_flow: Math.round(net_cash_flow),
      net_worth: Math.round(net_worth),
    })
  }

  return rows
}
