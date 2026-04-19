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
import {
  buildStrategyHorizons,
  computeBusinessOwnershipValue,
  longevityAndSurvivor,
} from '@/lib/my-estate-strategy/horizonSnapshots'
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

  // ── Auto-generate base case if inputs are complete and no base case exists ──
  if (!household.base_case_scenario_id) {
    // Check completeness — fetch just what we need to validate
    const [
      { data: incomeRows },
      { data: assetRows },
      { data: householdFull },
    ] = await Promise.all([
      supabase.from('income').select('id').eq('owner_id', ownerId).limit(1),
      supabase.from('assets').select('id').eq('owner_id', ownerId).limit(1),
      supabase
        .from('households')
        .select(
          'person1_name, person1_birth_year, person1_retirement_age, person1_longevity_age, person1_ss_pia, has_spouse, person2_name, person2_birth_year, person2_retirement_age, person2_longevity_age, person2_ss_pia',
        )
        .eq('id', household.id)
        .single(),
    ])

    const h = householdFull
    const p1Complete = !!(
      h?.person1_name &&
      h?.person1_birth_year &&
      h?.person1_retirement_age &&
      h?.person1_longevity_age &&
      h?.person1_ss_pia
    )
    const p2Complete = !h?.has_spouse || !!(
      h?.person2_name &&
      h?.person2_birth_year &&
      h?.person2_retirement_age &&
      h?.person2_longevity_age &&
      h?.person2_ss_pia
    )
    const hasIncome = (incomeRows ?? []).length > 0
    const hasAssets = (assetRows ?? []).length > 0

    if (p1Complete && p2Complete && hasIncome && hasAssets) {
      // Fire and don't await — page renders immediately, base case generates in background
      // Use admin client so it works for both consumer and advisor paths
      import('@/lib/actions/generate-base-case')
        .then(({ generateBaseCase }) => generateBaseCase(household.id))
        .catch((e) =>
          console.error('[my-estate-strategy] auto base case failed:', e),
        )
    }
  }

  const [
    { data: scenario },
    { data: assets },
    { data: liabilities },
    { data: realEstate },
    { data: businesses },
    { data: businessInterests },
    { data: insurance },
    { data: stateBracketRows },
  ] = await Promise.all([
    household.base_case_scenario_id
      ? admin
          .from('projection_scenarios')
          .select('outputs_s1_first, assumption_snapshot, calculated_at, label')
          .eq('id', household.base_case_scenario_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase.from('assets').select('value').eq('owner_id', ownerId),
    supabase.from('liabilities').select('balance').eq('owner_id', ownerId),
    supabase
      .from('real_estate')
      .select('current_value, mortgage_balance, is_primary_residence')
      .eq('owner_id', ownerId),
    supabase.from('businesses').select('estimated_value, ownership_pct').eq('owner_id', ownerId),
    supabase
      .from('business_interests')
      .select('fmv_estimated, total_entity_value, ownership_pct')
      .eq('owner_id', ownerId),
    supabase.from('insurance_policies').select('death_benefit, is_ilit').eq('user_id', ownerId),
    supabase
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', household?.state_primary ?? '')
      .eq('tax_year', new Date().getFullYear())
      .order('min_amount', { ascending: true }),
  ])

  const stateBrackets = stateBracketRows ?? []

  const financialAssets = (assets ?? []).reduce((s, a) => s + Number(a.value), 0)
  const realEstateEquity = (realEstate ?? []).reduce(
    (s, r) => s + Number(r.current_value) - Number(r.mortgage_balance ?? 0),
    0,
  )
  const businessValue = computeBusinessOwnershipValue(businesses ?? [], businessInterests ?? [])
  const insuranceValue = (insurance ?? [])
    .filter((p) => !p.is_ilit)
    .reduce((s, p) => s + Number(p.death_benefit ?? 0), 0)

  const totalAssets = financialAssets + realEstateEquity + businessValue + insuranceValue
  const totalLiabilities = (liabilities ?? []).reduce((s, l) => s + Number(l.balance), 0)
  const liveNetWorth = totalAssets - totalLiabilities

  const now = new Date()
  const currentYear = new Date().getFullYear()
  const currentMonthYearLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const p1EndYear =
    (household.person1_birth_year ?? currentYear - 50) + (household.person1_longevity_age ?? 90)
  const p2EndYear =
    household.has_spouse && household.person2_birth_year && household.person2_longevity_age
      ? household.person2_birth_year + household.person2_longevity_age
      : null
  const survivorEndYear = p2EndYear ? Math.max(p1EndYear, p2EndYear) : p1EndYear

  const hasSpouse = household.has_spouse ?? false

  const primaryResidenceEstValue = (realEstate ?? [])
    .filter((r) => r.is_primary_residence === true)
    .reduce((s, r) => s + Number(r.current_value ?? 0), 0)
  const primaryResidenceValueForUi =
    hasSpouse && primaryResidenceEstValue > 0 ? primaryResidenceEstValue : null
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
    stateBrackets,
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
        estateAsOfLabel={currentMonthYearLabel}
        primaryResidenceValue={primaryResidenceValueForUi}
        hasSpouse={hasSpouse}
        survivorEndYear={survivorEndYear}
        currentYear={currentYear}
      />
      <div className="max-w-6xl mx-auto px-4 pb-12">
        <DisclaimerBanner context="estate strategy" />
      </div>
    </div>
  )
}
