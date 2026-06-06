import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calcEstateTax,
  MC_DEPLETION_FLOOR,
  runEstateMonteCarlo,
  type PercentileByYear,
  type StateBracket,
} from '@/lib/calculations/estate-monte-carlo'
import { deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { currentFederalExemption } from '@/lib/export/narrativeEngine'
import { longevityAndSurvivor } from '@/lib/my-estate-strategy/horizonSnapshots'

async function fetchStateBrackets(
  supabase: SupabaseClient,
  stateCode: string,
): Promise<StateBracket[]> {
  const currentYear = new Date().getFullYear()
  let result = await supabase
    .from('state_estate_tax_rules')
    .select('min_amount, max_amount, rate_pct, exemption_amount')
    .eq('state', stateCode)
    .eq('tax_year', currentYear)
    .order('min_amount', { ascending: true })

  if ((result.data ?? []).length === 0) {
    result = await supabase
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', stateCode)
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true })
      .limit(20)
  }

  return (result.data ?? []) as StateBracket[]
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function runEstateMonteCarloAsync(
  householdId: string,
  scenarioId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const currentYear = new Date().getFullYear()

  const [householdRes, scenarioRes, lineItemsRes] = await Promise.all([
    supabase
      .from('households')
      .select(
        'state_primary, filing_status, has_spouse, person1_birth_year, person1_longevity_age, person2_birth_year, person2_longevity_age, growth_rate_accumulation',
      )
      .eq('id', householdId)
      .single(),
    supabase
      .from('projection_scenarios')
      .select('outputs_s1_first, assumption_snapshot')
      .eq('id', scenarioId)
      .single(),
    supabase
      .from('strategy_line_items')
      .select(
        'strategy_source, source_role, consumer_accepted, is_active, consumer_rejected',
      )
      .eq('household_id', householdId),
  ])

  const household = householdRes.data
  const outputs = (scenarioRes.data?.outputs_s1_first ?? []) as Array<{
    estate_incl_home?: number | null
  }>
  const latestOutput = outputs[0] ?? null

  if (!latestOutput || !household) {
    console.warn('[MC async] No projection data for household', householdId)
    return
  }

  const grossEstate = Number(latestOutput.estate_incl_home ?? 0)
  if (grossEstate <= 0) {
    console.warn('[MC async] grossEstate is 0, skipping', householdId)
    return
  }

  const stateCode = household.state_primary ?? ''
  const bracketsData = stateCode ? await fetchStateBrackets(supabase, stateCode) : []

  const isMFJ = household.filing_status === 'mfj' && !!household.has_spouse
  const federalExemption = currentFederalExemption(household.filing_status ?? 'single')
  const hasBypassTrust = deriveHasBypassTrustFromLineItems(
    lineItemsRes.data ?? [],
    'consumer_accepted',
  )

  const { longevityAge, survivorIsPerson1 } = longevityAndSurvivor({
    hasSpouse: !!household.has_spouse,
    person1Longevity: household.person1_longevity_age,
    person2Longevity: household.person2_longevity_age,
  })
  const survivorBirthYear = survivorIsPerson1
    ? household.person1_birth_year
    : household.person2_birth_year
  const survivorDeathYear = (survivorBirthYear ?? currentYear) + longevityAge
  const yearsUntilDeath = Math.max(5, survivorDeathYear - currentYear)

  const lawScenario = 'current_law' as const
  const hashInput = JSON.stringify({
    grossEstate,
    stateCode,
    filingStatus: household.filing_status,
    hasBypassTrust,
    yearsUntilDeath,
    lawScenario,
  })
  const assumption_hash = await sha256Hex(hashInput)

  const baseGrowthRate = Number(household.growth_rate_accumulation ?? 7) / 100

  const result = runEstateMonteCarlo({
    grossEstate,
    federalExemption,
    stateCode,
    stateBrackets: bracketsData,
    filingStatus: isMFJ ? 'mfj' : 'single',
    hasBypassTrust,
    yearsUntilDeath,
    baseGrowthRate,
    strategyEstatereduction: 0,
    lawScenario,
    simulationCount: 500,
    includeSensitivity: false,
  })

  const taxCtx = {
    stateCode,
    stateBrackets: bracketsData,
    filingStatus: (isMFJ ? 'mfj' : 'single') as 'single' | 'mfj',
    hasBypassTrust,
  }

  const person1BirthYear = household.person1_birth_year ?? currentYear - 65
  const percentiles_by_year: PercentileByYear[] = result.fan_chart_data.map((pt) => ({
    year: pt.year,
    age_p1: person1BirthYear + (pt.year - currentYear),
    p10_gross: pt.p10,
    p25_gross: pt.p25,
    p50_gross: pt.p50,
    p75_gross: pt.p75,
    p90_gross: pt.p90,
    p10_net: Math.max(0, pt.p10 - calcEstateTax(pt.p10, federalExemption, taxCtx, lawScenario)),
    p50_net: Math.max(0, pt.p50 - calcEstateTax(pt.p50, federalExemption, taxCtx, lawScenario)),
    p90_net: Math.max(0, pt.p90 - calcEstateTax(pt.p90, federalExemption, taxCtx, lawScenario)),
  }))

  const stateExemption = bracketsData[0]?.exemption_amount ?? 0

  const wa_threshold_prob_by_year =
    stateExemption > 0
      ? result.fan_chart_data.map((pt) => {
          let pct = 0
          if (pt.p10 > stateExemption) pct = 100
          else if (pt.p25 > stateExemption) pct = 90
          else if (pt.p50 > stateExemption) pct = 75
          else if (pt.p75 > stateExemption) pct = 50
          else if (pt.p90 > stateExemption) pct = 25
          return {
            year: pt.year,
            age_p1: person1BirthYear + (pt.year - currentYear),
            pct_above_threshold: pct,
          }
        })
      : null

  const first_tax_year_p10 =
    stateExemption > 0
      ? (result.fan_chart_data.find((pt) => pt.p10 > stateExemption)?.year ?? null)
      : null

  const lastBand = result.fan_chart_data.at(-1)
  let longevity_depletion_pct = 0
  if (lastBand) {
    if (lastBand.p50 < MC_DEPLETION_FLOOR) longevity_depletion_pct = 50
    else if (lastBand.p25 < MC_DEPLETION_FLOOR) longevity_depletion_pct = 25
    else if (lastBand.p10 < MC_DEPLETION_FLOOR) longevity_depletion_pct = 10
  }

  const { error: upsertError } = await supabase.from('monte_carlo_results').upsert(
    {
      household_id: householdId,
      scenario_id: scenarioId,
      simulation_count: 500,
      law_scenario: lawScenario,
      p10_estate: result.p10_estate,
      p25_estate: result.p25_estate,
      p50_estate: result.p50_estate,
      p75_estate: result.p75_estate,
      p90_estate: result.p90_estate,
      p10_tax: result.p10_tax,
      p50_tax: result.p50_tax,
      p90_tax: result.p90_tax,
      success_rate: result.success_rate,
      median_net_to_heirs: result.median_net_to_heirs,
      fan_chart_data: result.fan_chart_data,
      sensitivity_matrix: result.sensitivity_matrix,
      run_duration_ms: result.run_duration_ms,
      percentiles_by_year,
      assumption_hash,
      mc_calculated_at: new Date().toISOString(),
      engine_version: 'engine-b-v1',
      wa_threshold_prob_by_year,
      first_tax_year_p10,
      longevity_depletion_pct,
      depletion_floor_amount: MC_DEPLETION_FLOOR,
    },
    { onConflict: 'scenario_id' },
  )

  if (upsertError) {
    console.error('[MC async] upsert failed:', upsertError)
    throw upsertError
  }
}
