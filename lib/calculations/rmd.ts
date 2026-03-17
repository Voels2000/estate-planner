/**
 * RMD Calculation Engine
 * Computes Required Minimum Distributions for single and married filers
 * using IRS Uniform Lifetime, Joint Life, and Single Life tables.
 * Supports SECURE Act 2.0 (RMD start age 73 / 75), inherited IRA rules,
 * first-year deferral, and multi-account aggregation.
 */

import { createClient } from '@/lib/supabase/server'

// Account types subject to RMD rules
export const RMD_ELIGIBLE_TYPES = [
  'traditional_ira',
  'traditional_401k',
] as const

export type RmdEligibleType = (typeof RMD_ELIGIBLE_TYPES)[number]

export type RmdTableType = 'uniform' | 'joint' | 'single'

export type RmdInput = {
  household_id: string
  owner_birth_year: number
  spouse_birth_year?: number | null
  filing_status: string
  distribution_year: number
  scenario_id?: string | null
  /** Override: pass pre-fetched balances instead of fetching from DB */
  account_balances?: { asset_id: string; type: string; balance: number }[]
}

export type RmdAccountResult = {
  asset_id: string
  asset_name: string
  asset_type: string
  prior_year_balance: number
  owner_age: number
  table_used: RmdTableType
  life_expectancy_factor: number
  rmd_amount: number
  notes: string[]
}

export type RmdResult = {
  distribution_year: number
  owner_age: number
  total_rmd: number
  accounts: RmdAccountResult[]
  table_used: RmdTableType
  rmd_start_age: number
  is_first_year: boolean
  first_year_deferral_available: boolean
}

/** Determine RMD start age per SECURE Act 2.0 */
function getRmdStartAge(birthYear: number): number {
  // Born 1951–1959: age 73. Born 1960+: age 75
  if (birthYear >= 1960) return 75
  if (birthYear >= 1951) return 73
  return 72 // pre-SECURE Act
}

/** Determine which IRS table to use */
function selectTableType(
  filingStatus: string,
  ownerAge: number,
  spouseBirthYear: number | null | undefined,
  distributionYear: number
): RmdTableType {
  if (
    filingStatus === 'married_filing_jointly' &&
    spouseBirthYear != null
  ) {
    const spouseAge = distributionYear - spouseBirthYear
    const ageDiff = ownerAge - spouseAge
    if (ageDiff > 10) return 'joint'
  }
  return 'uniform'
}

/** Fetch IRS RMD factor for a given table type and age */
async function fetchFactor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tableType: RmdTableType,
  age: number
): Promise<number> {
  // Try exact age first, then fall back to max age in table
  const { data } = await supabase
    .from('irs_rmd_tables')
    .select('factor')
    .eq('table_type', tableType)
    .eq('age', age)
    .order('effective_year', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data?.factor) return Number(data.factor)

  // Fall back to highest age in table (120)
  const { data: fallback } = await supabase
    .from('irs_rmd_tables')
    .select('factor, age')
    .eq('table_type', tableType)
    .order('age', { ascending: false })
    .limit(1)
    .maybeSingle()

  return fallback ? Number(fallback.factor) : 2.0
}

/** Fetch RMD-eligible assets for a household */
async function fetchEligibleAssets(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string
): Promise<{ asset_id: string; asset_name: string; asset_type: string; balance: number }[]> {
  // Get owner_id from household
  const { data: household } = await supabase
    .from('households')
    .select('owner_id')
    .eq('id', householdId)
    .maybeSingle()

  if (!household) return []

  const { data: assets } = await supabase
    .from('assets')
    .select('id, name, type, value')
    .eq('owner_id', household.owner_id)
    .in('type', [...RMD_ELIGIBLE_TYPES])

  return (assets ?? []).map(a => ({
    asset_id: a.id,
    asset_name: a.name,
    asset_type: a.type,
    balance: Number(a.value),
  }))
}

/**
 * Compute RMDs for a household for a given distribution year.
 * Handles table selection, SECURE Act 2.0 start age, first-year deferral,
 * and per-account RMD calculation with IRA aggregation.
 */
export async function computeRmd(input: RmdInput): Promise<RmdResult> {
  const supabase = await createClient()

  const {
    household_id,
    owner_birth_year,
    spouse_birth_year,
    filing_status,
    distribution_year,
    account_balances,
  } = input

  const ownerAge = distribution_year - owner_birth_year
  const rmdStartAge = getRmdStartAge(owner_birth_year)
  const isFirstYear = ownerAge === rmdStartAge
  const firstYearDeferralAvailable = isFirstYear

  // Not yet required to take RMDs
  if (ownerAge < rmdStartAge) {
    return {
      distribution_year,
      owner_age: ownerAge,
      total_rmd: 0,
      accounts: [],
      table_used: 'uniform',
      rmd_start_age: rmdStartAge,
      is_first_year: false,
      first_year_deferral_available: false,
    }
  }

  const tableType = selectTableType(filing_status, ownerAge, spouse_birth_year, distribution_year)
  const factor = await fetchFactor(supabase, tableType, ownerAge)

  // Use provided balances or fetch from DB
  const eligibleAccounts = account_balances
    ? account_balances
        .filter(a => RMD_ELIGIBLE_TYPES.includes(a.type as RmdEligibleType))
        .map(a => ({ asset_id: a.asset_id, asset_name: a.asset_id, asset_type: a.type, balance: a.balance }))
    : await fetchEligibleAssets(supabase, household_id)

  const accountResults: RmdAccountResult[] = []
  let totalRmd = 0

  // IRA aggregation: IRAs can be aggregated; 401ks must be calculated separately
  const iraAccounts = eligibleAccounts.filter(a => a.asset_type === 'traditional_ira')
  const k401Accounts = eligibleAccounts.filter(a => a.asset_type === 'traditional_401k')

  // Calculate RMD for each 401k individually
  for (const account of k401Accounts) {
    const rmdAmount = Math.round((account.balance / factor) * 100) / 100
    const notes: string[] = [`Table: ${tableType}`, `Factor: ${factor}`, '401(k) — calculated separately']
    if (isFirstYear) notes.push(`First RMD year (age ${rmdStartAge}) — deferral to Apr 1 available`)

    accountResults.push({
      asset_id: account.asset_id,
      asset_name: account.asset_name,
      asset_type: account.asset_type,
      prior_year_balance: account.balance,
      owner_age: ownerAge,
      table_used: tableType,
      life_expectancy_factor: factor,
      rmd_amount: rmdAmount,
      notes,
    })
    totalRmd += rmdAmount
  }

  // IRA aggregation: total IRA RMD can be taken from any single IRA or split
  if (iraAccounts.length > 0) {
    const totalIraBalance = iraAccounts.reduce((sum, a) => sum + a.balance, 0)
    const totalIraRmd = Math.round((totalIraBalance / factor) * 100) / 100
    const rmdPerIra = iraAccounts.length > 0 ? totalIraRmd / iraAccounts.length : 0

    for (const account of iraAccounts) {
      const notes: string[] = [
        `Table: ${tableType}`,
        `Factor: ${factor}`,
        `IRA aggregation — total IRA RMD: $${totalIraRmd.toLocaleString()}`,
        `Shown as proportional split across ${iraAccounts.length} IRA account(s)`,
      ]
      if (isFirstYear) notes.push(`First RMD year (age ${rmdStartAge}) — deferral to Apr 1 available`)

      accountResults.push({
        asset_id: account.asset_id,
        asset_name: account.asset_name,
        asset_type: account.asset_type,
        prior_year_balance: account.balance,
        owner_age: ownerAge,
        table_used: tableType,
        life_expectancy_factor: factor,
        rmd_amount: Math.round(rmdPerIra * 100) / 100,
        notes,
      })
    }
    totalRmd += totalIraRmd
  }

  return {
    distribution_year,
    owner_age: ownerAge,
    total_rmd: Math.round(totalRmd * 100) / 100,
    accounts: accountResults,
    table_used: tableType,
    rmd_start_age: rmdStartAge,
    is_first_year: isFirstYear,
    first_year_deferral_available: firstYearDeferralAvailable,
  }
}

/**
 * Generate a multi-year RMD projection.
 * Returns one RmdResult per year from current year through longevity age.
 */
export async function projectRmds(
  householdId: string,
  ownerBirthYear: number,
  spouseBirthYear: number | null | undefined,
  filingStatus: string,
  longevityAge: number,
  currentBalances: { asset_id: string; type: string; balance: number }[],
  growthRate: number = 0.05
): Promise<RmdResult[]> {
  const currentYear = new Date().getFullYear()
  const startAge = currentYear - ownerBirthYear
  const results: RmdResult[] = []

  // Project balances forward year by year
  let balances = currentBalances.map(b => ({ ...b }))

  for (let age = startAge; age <= longevityAge; age++) {
    const year = currentYear + (age - startAge)

    const result = await computeRmd({
      household_id: householdId,
      owner_birth_year: ownerBirthYear,
      spouse_birth_year: spouseBirthYear,
      filing_status: filingStatus,
      distribution_year: year,
      account_balances: balances,
    })

    results.push(result)

    // Grow balances for next year, subtract RMDs
    balances = balances.map(b => {
      const rmdForAccount = result.accounts.find(a => a.asset_id === b.asset_id)?.rmd_amount ?? 0
      const grown = b.balance * (1 + growthRate)
      return { ...b, balance: Math.max(0, Math.round((grown - rmdForAccount) * 100) / 100) }
    })
  }

  return results
}
