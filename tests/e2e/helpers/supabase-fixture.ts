import type { ProfileSavePayload } from '../../../lib/profile/buildHouseholdPayload'

function supabaseRestConfig(): { url: string; key: string } | null {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return { url: url.replace(/\/$/, ''), key }
}

async function restGet<T>(table: string, query: string): Promise<T | null> {
  const cfg = supabaseRestConfig()
  if (!cfg) return null
  const res = await fetch(`${cfg.url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return null
  const rows = (await res.json()) as T[]
  return rows[0] ?? null
}

type HouseholdRow = {
  id: string
  owner_id: string
  name: string | null
  person1_name: string | null
  person1_birth_year: number | null
  person1_retirement_age: number | null
  person1_ss_claiming_age: number | null
  person1_longevity_age: number | null
  person1_ss_pia: number | null
  has_spouse: boolean | null
  person2_name: string | null
  person2_birth_year: number | null
  person2_retirement_age: number | null
  person2_ss_claiming_age: number | null
  person2_longevity_age: number | null
  person2_ss_pia: number | null
  filing_status: string | null
  state_primary: string | null
  state_compare: string | null
  inflation_rate: number | null
  risk_tolerance: string | null
  growth_rate_accumulation: number | null
  growth_rate_retirement: number | null
  growth_assumptions: { real_estate?: number; business?: number } | null
  deduction_mode: string | null
  custom_deduction_amount: number | null
}

export type HouseholdPlanningFields = {
  inflation_rate: number
  growth_rate_accumulation: number
  growth_rate_retirement: number
  growth_assumptions: { real_estate: number; business: number }
}

export async function fetchHouseholdById(householdId: string): Promise<HouseholdRow | null> {
  return restGet<HouseholdRow>('households', `id=eq.${householdId}&select=*`)
}

/** Deferred profile fields surfaced by ProfileFieldPrompt on /social-security and /scenarios. */
export type HouseholdDeferredFields = Pick<
  HouseholdRow,
  | 'person1_ss_claiming_age'
  | 'person1_ss_pia'
  | 'person1_longevity_age'
  | 'deduction_mode'
  | 'custom_deduction_amount'
>

export function pickDeferredFields(row: HouseholdRow): HouseholdDeferredFields {
  return {
    person1_ss_claiming_age: row.person1_ss_claiming_age,
    person1_ss_pia: row.person1_ss_pia,
    person1_longevity_age: row.person1_longevity_age,
    deduction_mode: row.deduction_mode,
    custom_deduction_amount: row.custom_deduction_amount,
  }
}

/** Service-role PATCH for e2e setup/teardown (inline prompt tests). */
export async function patchHouseholdById(
  householdId: string,
  fields: Record<string, unknown>,
): Promise<boolean> {
  const cfg = supabaseRestConfig()
  if (!cfg) return false
  const res = await fetch(`${cfg.url}/rest/v1/households?id=eq.${householdId}`, {
    method: 'PATCH',
    headers: {
      apikey: cfg.key,
      Authorization: `Bearer ${cfg.key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  })
  return res.ok
}

export async function restoreHouseholdDeferredFields(
  householdId: string,
  snapshot: HouseholdDeferredFields,
): Promise<boolean> {
  return patchHouseholdById(householdId, { ...snapshot })
}

export async function fetchHouseholdPlanningFields(
  householdId: string,
): Promise<HouseholdPlanningFields | null> {
  const household = await restGet<HouseholdRow>(
    'households',
    `id=eq.${householdId}&select=inflation_rate,growth_rate_accumulation,growth_rate_retirement,growth_assumptions`,
  )
  if (!household) return null
  const ga = household.growth_assumptions ?? {}
  return {
    inflation_rate: household.inflation_rate ?? 2.5,
    growth_rate_accumulation: household.growth_rate_accumulation ?? 6,
    growth_rate_retirement: household.growth_rate_retirement ?? 5,
    growth_assumptions: {
      real_estate: Number(ga.real_estate ?? 4.5),
      business: Number(ga.business ?? 7.0),
    },
  }
}

type ProfileRow = {
  full_name: string | null
  email: string | null
}

export async function buildProfilePayloadFromHousehold(
  householdId: string,
): Promise<ProfileSavePayload | null> {
  const household = await restGet<HouseholdRow>(
    'households',
    `id=eq.${householdId}&select=*`,
  )
  if (!household) return null

  const profile = await restGet<ProfileRow>(
    'profiles',
    `id=eq.${household.owner_id}&select=full_name,email`,
  )
  if (!profile?.email) return null

  const hasSpouse = Boolean(household.has_spouse)
  return {
    householdId: household.id,
    fullName: profile.full_name ?? 'Playwright User',
    email: profile.email,
    householdName: household.name ?? 'Test Household',
    person1Name: household.person1_name ?? 'Person One',
    person1BirthYear: String(household.person1_birth_year ?? 1965),
    person1RetirementAge: String(household.person1_retirement_age ?? 65),
    person1SSClaimingAge: String(household.person1_ss_claiming_age ?? 67),
    person1LongevityAge: String(household.person1_longevity_age ?? 90),
    person1SSPia: household.person1_ss_pia != null ? String(household.person1_ss_pia) : '',
    hasSpouse,
    person2Name: household.person2_name ?? '',
    person2BirthYear: String(household.person2_birth_year ?? 1965),
    person2RetirementAge: String(household.person2_retirement_age ?? 65),
    person2SSClaimingAge: String(household.person2_ss_claiming_age ?? 67),
    person2LongevityAge: String(household.person2_longevity_age ?? 90),
    person2SSPia: household.person2_ss_pia != null ? String(household.person2_ss_pia) : '',
    filingStatus: household.filing_status ?? 'married_filing_jointly',
    statePrimary: household.state_primary ?? 'WA',
    stateCompare: household.state_compare ?? '',
    inflationRate: String(household.inflation_rate ?? 2.5),
    riskTolerance: household.risk_tolerance ?? 'moderate',
    growthRateAccumulation: String(household.growth_rate_accumulation ?? 6),
    growthRateRetirement: String(household.growth_rate_retirement ?? 5),
    deductionMode:
      (household.deduction_mode as ProfileSavePayload['deductionMode']) ?? 'standard',
    customDeductionAmount:
      household.custom_deduction_amount != null
        ? String(household.custom_deduction_amount)
        : '',
  }
}

export async function queryReferralClickLatest(
  referralCode: string,
  listingType: 'advisor' | 'attorney',
): Promise<{ id: string } | null> {
  const cfg = supabaseRestConfig()
  if (!cfg) return null
  const res = await fetch(
    `${cfg.url}/rest/v1/referral_clicks?referral_code=eq.${encodeURIComponent(referralCode)}&listing_type=eq.${listingType}&order=created_at.desc&limit=1&select=id`,
    {
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        Accept: 'application/json',
      },
    },
  )
  if (!res.ok) return null
  const rows = (await res.json()) as { id: string }[]
  return rows[0] ?? null
}
