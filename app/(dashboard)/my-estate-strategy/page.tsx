// ─────────────────────────────────────────
// Menu: Estate Planning > My Estate Strategy
// Route: /my-estate-strategy
// ─────────────────────────────────────────

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DisclaimerBanner } from '@/lib/components/DisclaimerBanner'
import { displayPersonFirstName } from '@/lib/display-person-name'
import type { AnnualOutput } from '@/lib/types/projection-scenario'
import { buildStrategyHorizons, longevityAndSurvivor } from '@/lib/my-estate-strategy/horizonSnapshots'
import MyEstateStrategyClient from './_my-estate-strategy-client'

export default async function MyEstateStrategyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: household } = await supabase
    .from('households')
    .select(
      'id, base_case_scenario_id, person1_name, person2_name, person1_birth_year, person2_birth_year, person1_longevity_age, person2_longevity_age, has_spouse, filing_status, state_primary',
    )
    .eq('owner_id', user.id)
    .single()

  if (!household) redirect('/profile')

  const ownerId = user.id

  const [
    { data: scenario },
    { data: federalTaxConfigs },
    { data: assets },
    { data: liabilities },
    { data: realEstate },
    { data: businesses },
    { data: insurance },
  ] = await Promise.all([
    household.base_case_scenario_id
      ? admin
          .from('projection_scenarios')
          .select('outputs_s1_first, assumption_snapshot, calculated_at, label')
          .eq('id', household.base_case_scenario_id)
          .single()
      : Promise.resolve({ data: null }),
    admin
      .from('federal_tax_config')
      .select('scenario_id, estate_exemption_individual, estate_exemption_married, estate_top_rate_pct')
      .eq('is_active', true),
    supabase.from('assets').select('value').eq('owner_id', ownerId),
    supabase.from('liabilities').select('balance').eq('owner_id', ownerId),
    supabase.from('real_estate').select('current_value, mortgage_balance').eq('owner_id', ownerId),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', ownerId),
    supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', ownerId),
  ])

  const financialAssets = (assets ?? []).reduce((s, a) => s + Number(a.value), 0)
  const realEstateEquity = (realEstate ?? []).reduce(
    (s, r) => s + Number(r.current_value) - Number(r.mortgage_balance ?? 0),
    0,
  )
  const businessValue = (businesses ?? []).reduce(
    (s, b) => s + Number(b.estimated_value) * (Number(b.ownership_pct ?? 100) / 100),
    0,
  )
  const insuranceValue = (insurance ?? [])
    .filter((p) => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  const totalAssets = financialAssets + realEstateEquity + businessValue + insuranceValue
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const liveNetWorth = totalAssets - totalLiabilities

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonthYearLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const hasSpouse = household.has_spouse ?? false
  const { longevityAge, survivorIsPerson1 } = longevityAndSurvivor({
    hasSpouse,
    person1Longevity: household.person1_longevity_age,
    person2Longevity: household.person2_longevity_age,
  })

  const survivorFirstName = !hasSpouse
    ? displayPersonFirstName(household.person1_name, 'You')
    : survivorIsPerson1
      ? displayPersonFirstName(household.person1_name, 'You')
      : displayPersonFirstName(household.person2_name, 'You')

  const scenarioRows = (scenario?.outputs_s1_first ?? null) as AnnualOutput[] | null

  const horizons = buildStrategyHorizons({
    currentYear,
    currentMonthYearLabel,
    liveNetWorth,
    household: {
      state_primary: household.state_primary,
      filing_status: household.filing_status,
      has_spouse: household.has_spouse,
      person1_name: household.person1_name,
      person2_name: household.person2_name,
      person1_birth_year: household.person1_birth_year,
      person2_birth_year: household.person2_birth_year,
      person1_longevity_age: household.person1_longevity_age,
      person2_longevity_age: household.person2_longevity_age,
    },
    federalConfigs: federalTaxConfigs ?? [],
    scenarioRows,
    survivorFirstName,
    longevityAge,
  })

  return (
    <div className="min-h-screen">
      <MyEstateStrategyClient
        householdId={household.id}
        scenarioId={household.base_case_scenario_id}
        scenarioMeta={{
          calculatedAt: scenario?.calculated_at ?? null,
        }}
        horizons={horizons}
      />
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <DisclaimerBanner context="estate strategy" />
      </div>
    </div>
  )
}
