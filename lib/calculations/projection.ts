/**
 * Server-side projection engine: fetches household data from Supabase and
 * returns a year-by-year financial projection using the RMD uniform lifetime table.
 */

import { createClient } from '@/lib/supabase/server'
import type { AssetRow } from '@/lib/validations/assets'

/** Household row as stored (matches Supabase households table columns) */
export type HouseholdForProjection = {
  id: string
  owner_id: string
  person1_name: string
  person1_birth_year: number | null
  person1_retirement_age: number | null
  person1_ss_claiming_age: number | null
  person1_longevity_age: number | null
  has_spouse: boolean
  person2_name: string | null
  person2_birth_year: number | null
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  person2_longevity_age: number | null
  filing_status: string
  state_primary: string | null
  state_compare: string | null
  state_secondary: string | null
  inflation_rate: number
  growth_rate_accumulation: number
  growth_rate_retirement: number

}

/** Income row: annual or recurring income for the household */
export type IncomeRow = {
  id: string
  owner_id: string
  amount: number
  start_year?: number | null
  end_year?: number | null
  inflation_adjust?: boolean | null
  source?: string | null
}

/** Expense row: annual or recurring expense */
export type ExpenseRow = {
  id: string
  owner_id: string
  amount: number
  start_year?: number | null
  end_year?: number | null
  inflation_adjust?: boolean | null
  category?: string | null
}

/** Federal tax bracket row (min/max in dollars, rate in percent) */
export type FederalTaxBracketRow = {
  id: string
  filing_status: string
  bracket_order: number
  min_amount: number
  max_amount: number
  rate_pct: number
}

/** State tax rate row (flat rate in percent) */
export type StateTaxRateRow = {
  id: string
  state_code: string
  rate_pct: number
}

/** RMD uniform lifetime table: age -> distribution period */
export type RmdUniformLifetimeRow = {
  age: number
  distribution_period: number
}

/** One year in the projection output */
export type ProjectionYear = {
  year: number
  person1_age: number
  gross_income: number
  rmd_amount: number
  taxable_income: number
  federal_tax: number
  state_tax: number
  total_expenses: number
  net_cash_flow: number
  total_net_worth: number
  account_balances: Record<string, number>
}

export type ProjectionOptions = {
  /** Override birth year for person1 if not in household (e.g. 1960) */
  person1_birth_year?: number
  /** First projection year (default: current year) */
  start_year?: number
  /** Last projection year (default: start_year + 40) */
  end_year?: number
  /** Nominal growth rate for assets, e.g. 0.05 for 5% (default: 0.05) */
  growth_rate?: number
  /** Standard deduction for taxable income (default: inflation-adjusted from 2025 single/joint) */
  standard_deduction?: number
  /** Override state of residence for tax (scenario comparison) */
  state_primary?: string | null
  /** Override second state for tax comparison */
  state_compare?: string | null
  /** Override secondary state for tax */
  state_secondary?: string | null
  /** Override retirement age for person1 (scenario comparison). Before this age: salary income included. After: salary stops, assets drawn down. */
  person1_retirement_age?: number | null
  /** Override Social Security claiming age for person1 (scenario comparison). At or after this age: SS income from income entries with source social_security. */
  person1_ss_claiming_age?: number | null
}

const RMD_ELIGIBLE_TYPES = ['traditional_ira', 'traditional_401k'] as const
const CURRENT_YEAR = new Date().getFullYear()

/** Fetch household by id; returns null if not found or no access. */
async function fetchHousehold(supabase: Awaited<ReturnType<typeof createClient>>, householdId: string) {
  const { data, error } = await supabase
    .from('households')
    .select(
       'id, owner_id, person1_name, person1_birth_year, person1_retirement_age, person1_ss_claiming_age, person1_longevity_age, has_spouse, person2_name, person2_birth_year, person2_retirement_age, person2_ss_claiming_age, person2_longevity_age, filing_status, state_primary, state_compare, state_secondary, inflation_rate, growth_rate_accumulation, growth_rate_retirement'
    )
    .eq('id', householdId)
    .maybeSingle()
  if (error) throw new Error(`Failed to fetch household: ${error.message}`)
  return data as HouseholdForProjection | null
}

/** Fetch assets by owner_id. */
async function fetchAssets(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string): Promise<AssetRow[]> {
  const { data, error } = await supabase
    .from('assets')
    .select('id, owner_id, type, name, value, details, created_at, updated_at, owner')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to fetch assets: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    type: row.type,
    name: row.name ?? '',
    value: Number(row.value ?? 0),
    details: (row.details as Record<string, unknown>) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner: String((row as Record<string, unknown>).owner ?? ''),
  }))
}

/** Fetch income rows by owner_id. Uses table "income" if present. */
async function fetchIncome(supabase: Awaited<ReturnType<typeof createClient>>, ownerId: string): Promise<IncomeRow[]> {
  const { data, error } = await supabase
    .from('income')
    .select('id, owner_id, amount, start_year, end_year, inflation_adjust, source')
    .eq('owner_id', ownerId)
  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    amount: Number(row.amount ?? 0),
    start_year: row.start_year != null ? Number(row.start_year) : null,
    end_year: row.end_year != null ? Number(row.end_year) : null,
    inflation_adjust: row.inflation_adjust ?? true,
    source: row.source ?? null,
  }))
}

/** Fetch expense rows by owner_id. Uses table "expenses" if present. */
async function fetchExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string
): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, owner_id, amount, start_year, end_year, inflation_adjust, category')
    .eq('owner_id', ownerId)
  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    owner_id: row.owner_id,
    amount: Number(row.amount ?? 0),
    start_year: row.start_year != null ? Number(row.start_year) : null,
    end_year: row.end_year != null ? Number(row.end_year) : null,
    inflation_adjust: row.inflation_adjust ?? true,
    category: row.category ?? null,
  }))
}

/** Fetch federal tax brackets (all statuses). Table: federal_tax_brackets */
async function fetchFederalTaxBrackets(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<FederalTaxBracketRow[]> {
  const { data, error } = await supabase
    .from('federal_tax_brackets')
    .select('id, filing_status, bracket_order, min_amount, max_amount, rate_pct')
    .order('bracket_order', { ascending: true })
  if (error) return getDefaultFederalBrackets()
  return (data ?? []).map((row) => ({
    id: row.id,
    filing_status: row.filing_status,
    bracket_order: Number(row.bracket_order),
    min_amount: Number(row.min_amount),
    max_amount: Number(row.max_amount),
    rate_pct: Number(row.rate_pct),
  }))
}

/** Fetch state tax rates. Table: state_tax_rates */
async function fetchStateTaxRates(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<StateTaxRateRow[]> {
  const { data, error } = await supabase
    .from('state_tax_rates')
    .select('id, state_code, rate_pct')
  if (error) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    state_code: String(row.state_code).toUpperCase(),
    rate_pct: Number(row.rate_pct),
  }))
}

/** Fetch RMD uniform lifetime table from database. Table: rmd_uniform_lifetime */
async function fetchRmdTable(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from('rmd_uniform_lifetime')
    .select('age, distribution_period')
    .order('age', { ascending: true })
  if (error) throw new Error(`Failed to fetch RMD table: ${error.message}. Ensure table rmd_uniform_lifetime exists.`)
  const map = new Map<number, number>()
  for (const row of data ?? []) {
    map.set(Number(row.age), Number(row.distribution_period))
  }
  if (map.size === 0) throw new Error('RMD uniform lifetime table is empty.')
  return map
}

/** Default federal brackets (2025 MFJ-style) if table missing. */
function getDefaultFederalBrackets(): FederalTaxBracketRow[] {
  const brackets = [
    { min: 0, max: 23850, rate: 10 },
    { min: 23851, max: 96950, rate: 12 },
    { min: 96951, max: 206700, rate: 22 },
    { min: 206701, max: 394600, rate: 24 },
    { min: 394601, max: 501050, rate: 32 },
    { min: 501051, max: 751600, rate: 35 },
    { min: 751601, max: Infinity, rate: 37 },
  ]
  return brackets.map((b, i) => ({
    id: `default-${i}`,
    filing_status: 'married_filing_jointly',
    bracket_order: i,
    min_amount: b.min,
    max_amount: b.max,
    rate_pct: b.rate,
  }))
}

/** Compute federal tax (progressive brackets). */
function computeFederalTax(
  taxableIncome: number,
  filingStatus: string,
  brackets: FederalTaxBracketRow[]
): number {
  const statusBrackets = brackets.filter((b) => b.filing_status === filingStatus)
  const sorted = (statusBrackets.length > 0 ? statusBrackets : brackets)
    .slice()
    .sort((a, b) => a.bracket_order - b.bracket_order)
  if (sorted.length === 0 || taxableIncome <= 0) return 0
  let tax = 0
  let remaining = taxableIncome
  for (const b of sorted) {
    if (remaining <= 0) break
    const bracketWidth = b.max_amount >= 1e9 ? Infinity : b.max_amount - b.min_amount + 1
    const taxableInBracket = Math.min(remaining, bracketWidth)
    tax += taxableInBracket * (b.rate_pct / 100)
    remaining -= taxableInBracket
  }
  return Math.round(tax * 100) / 100
}

/** Get RMD divisor for age from uniform lifetime table; 0 if not required (e.g. under 73). */
function getRmdDivisor(age: number, rmdTable: Map<number, number>): number {
  if (age < 73) return 0
  const divisor = rmdTable.get(age) ?? rmdTable.get(120) ?? 0
  return divisor
}

/** Sum income from rows matching a source filter, for a given year (inflation-adjusted). */
function getIncomeForYearBySource(
  year: number,
  incomeRows: IncomeRow[],
  inflationPct: number,
  baseYear: number,
  sourceFilter: (source: string | null) => boolean
): number {
  let total = 0
  const inflationFactor = (1 + inflationPct / 100) ** (year - baseYear)
  for (const row of incomeRows) {
    if (!sourceFilter(row.source ?? null)) continue
    const start = row.start_year ?? baseYear
    const end = row.end_year ?? 9999
    if (year < start || year > end) continue
    const amount = row.inflation_adjust ? row.amount * inflationFactor : row.amount
    total += amount
  }
  return Math.round(total * 100) / 100
}

/** Salary income for a year: only 'salary' source, and only when person1 is before retirement age. */
function getSalaryIncomeForYear(
  year: number,
  incomeRows: IncomeRow[],
  inflationPct: number,
  baseYear: number,
  person1Age: number,
  retirementAge: number | null
): number {
  if (retirementAge != null && person1Age >= retirementAge) return 0
  return getIncomeForYearBySource(
    year,
    incomeRows,
    inflationPct,
    baseYear,
    (s) => s === 'salary'
  )
}

/** Social Security income for a year: only 'social_security' source, and only when person1 is at or past claiming age. */
function getSSIncomeForYear(
  year: number,
  incomeRows: IncomeRow[],
  inflationPct: number,
  baseYear: number,
  person1Age: number,
  ssClaimingAge: number | null
): number {
  if (ssClaimingAge == null || person1Age < ssClaimingAge) return 0
  return getIncomeForYearBySource(
    year,
    incomeRows,
    inflationPct,
    baseYear,
    (s) => s === 'social_security'
  )
}

/** Other income (pension, rental, other): no age gate; included whenever row's start/end year applies. */
function getOtherIncomeForYear(
  year: number,
  incomeRows: IncomeRow[],
  inflationPct: number,
  baseYear: number
): number {
  return getIncomeForYearBySource(
    year,
    incomeRows,
    inflationPct,
    baseYear,
    (s) => s !== 'salary' && s !== 'social_security'
  )
}

/** Compute total expenses for a year (inflation-adjusted from base). */
function getExpensesForYear(
  year: number,
  expenseRows: ExpenseRow[],
  inflationPct: number,
  baseYear: number
): number {
  let total = 0
  const inflationFactor = (1 + inflationPct / 100) ** (year - baseYear)
  for (const row of expenseRows) {
    const start = row.start_year ?? baseYear
    const end = row.end_year ?? 9999
    if (year < start || year > end) continue
    const amount = row.inflation_adjust ? row.amount * inflationFactor : row.amount
    total += amount
  }
  return Math.round(total * 100) / 100
}

/**
 * Run the full projection for a household.
 * Fetches all data from Supabase (assets, income, expenses, tax tables, RMD table)
 * and returns a year-by-year projection array.
 */
export async function runProjection(
  householdId: string,
  options: ProjectionOptions = {}
): Promise<ProjectionYear[]> {
  const supabase = await createClient()
  const household = await fetchHousehold(supabase, householdId)
  if (!household) throw new Error(`Household not found: ${householdId}`)

  const person1BirthYear =
    options.person1_birth_year ??
    (household.person1_birth_year != null ? Number(household.person1_birth_year) : null)
  const person1RetirementAge =
    options.person1_retirement_age !== undefined
      ? options.person1_retirement_age
      : household.person1_retirement_age != null
        ? Number(household.person1_retirement_age)
        : null
  const person1SsClaimingAge =
    options.person1_ss_claiming_age !== undefined
      ? options.person1_ss_claiming_age
      : household.person1_ss_claiming_age != null
        ? Number(household.person1_ss_claiming_age)
        : null
  const statePrimary = options.state_primary !== undefined ? options.state_primary : household.state_primary
  const stateCompare = options.state_compare !== undefined ? options.state_compare : household.state_compare
  const stateCodes = [statePrimary, stateCompare].filter(
    (s): s is string => typeof s === 'string' && s.length === 2
  )
  if (person1BirthYear == null) {
    throw new Error('person1_birth_year is required (set on household or pass in options)')
  }

  const startYear = options.start_year ?? CURRENT_YEAR
  const endYear = options.end_year ?? startYear + 40
  const growthRateAccumulation = (household.growth_rate_accumulation ?? 7) / 100
  const growthRateRetirement = (household.growth_rate_retirement ?? 5) / 100
  const inflationPct = household.inflation_rate ?? 3
  const baseYear = startYear

  const [assets, incomeRows, expenseRows, federalBrackets, stateRates, rmdTable] = await Promise.all([
    fetchAssets(supabase, household.owner_id),
    fetchIncome(supabase, household.owner_id),
    fetchExpenses(supabase, household.owner_id),
    fetchFederalTaxBrackets(supabase),
    fetchStateTaxRates(supabase),
    fetchRmdTable(supabase),
  ])

  const standardDeduction =
    options.standard_deduction ??
    (household.filing_status === 'married_filing_jointly' ? 29200 : 14600)

  const result: ProjectionYear[] = []
  const assetIds = assets.map((a) => a.id)
  let balances: Record<string, number> = {}
  for (const a of assets) {
    balances[a.id] = a.value
  }

  for (let year = startYear; year <= endYear; year++) {
    const person1Age = year - person1BirthYear
    const salaryIncome = getSalaryIncomeForYear(
      year,
      incomeRows,
      inflationPct,
      baseYear,
      person1Age,
      person1RetirementAge
    )
    const ssIncome = getSSIncomeForYear(
      year,
      incomeRows,
      inflationPct,
      baseYear,
      person1Age,
      person1SsClaimingAge
    )
    const otherIncome = getOtherIncomeForYear(year, incomeRows, inflationPct, baseYear)
    const grossIncome = salaryIncome + ssIncome + otherIncome
    const totalExpenses = getExpensesForYear(year, expenseRows, inflationPct, baseYear)

    let rmdTotal = 0
    const rmdDivisor = getRmdDivisor(person1Age, rmdTable)
    if (rmdDivisor > 0) {
      for (const a of assets) {
        if (RMD_ELIGIBLE_TYPES.includes(a.type as (typeof RMD_ELIGIBLE_TYPES)[number])) {
          const bal = balances[a.id] ?? 0
          rmdTotal += bal / rmdDivisor
        }
      }
    }
    rmdTotal = Math.round(rmdTotal * 100) / 100

    const taxableIncome = Math.max(0, grossIncome + rmdTotal - standardDeduction)
    const federalTax = computeFederalTax(taxableIncome, household.filing_status, federalBrackets)
    const stateRate =
      (stateCodes.length
        ? stateCodes.reduce((sum, code) => {
            const r = stateRates.find((s) => s.state_code === String(code).toUpperCase())
            return sum + (r?.rate_pct ?? 0) / 100
          }, 0) / Math.max(1, stateCodes.length)
        : 0) / 100
    const stateTax = Math.round(taxableIncome * stateRate * 100) / 100

    const netCashFlow = grossIncome + rmdTotal - federalTax - stateTax - totalExpenses

    for (const a of assets) {
      const prev = balances[a.id] ?? 0
      const isRetired = person1RetirementAge != null && person1Age >= person1RetirementAge
      const growthRate = isRetired
        ? (household.growth_rate_retirement ?? 5) / 100
        : (household.growth_rate_accumulation ?? 7) / 100
      let next = prev * (1 + growthRate)
      if (RMD_ELIGIBLE_TYPES.includes(a.type as (typeof RMD_ELIGIBLE_TYPES)[number]) && rmdDivisor > 0) {
        const rmdForAccount = prev / rmdDivisor
        next = Math.max(0, next - rmdForAccount)
      }
      balances[a.id] = Math.round(next * 100) / 100
    }
    const taxableBrokerageIds = assets.filter((a) => a.type === 'taxable_brokerage').map((a) => a.id)
    if (taxableBrokerageIds.length > 0) {
      const addPerAccount = netCashFlow / taxableBrokerageIds.length
      for (const id of taxableBrokerageIds) {
        balances[id] = Math.round((balances[id] + addPerAccount) * 100) / 100
      }
    } else if (netCashFlow !== 0) {
      const firstId = assetIds[0]
      if (firstId) balances[firstId] = Math.round((balances[firstId] + netCashFlow) * 100) / 100
    }

    const totalNetWorth = Object.values(balances).reduce((s, v) => s + v, 0)
    const accountBalancesSnapshot: Record<string, number> = {}
    for (const id of assetIds) {
      accountBalancesSnapshot[id] = balances[id] ?? 0
    }
    result.push({
      year,
      person1_age: person1Age,
      gross_income: grossIncome,
      rmd_amount: rmdTotal,
      taxable_income: Math.round(taxableIncome * 100) / 100,
      federal_tax: federalTax,
      state_tax: stateTax,
      total_expenses: totalExpenses,
      net_cash_flow: Math.round(netCashFlow * 100) / 100,
      total_net_worth: Math.round(totalNetWorth * 100) / 100,
      account_balances: accountBalancesSnapshot,
    })
  }

  return result
}
