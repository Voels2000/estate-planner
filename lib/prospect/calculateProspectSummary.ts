import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateStateEstateTax,
  type StateBracket,
} from '@/lib/calculations/stateEstateTax'
import { getProspectTaxConfig, type ProspectTaxConfig } from '@/lib/prospect/getProspectTaxConfig'
import { PROSPECT_ASSET_MIDPOINTS } from '@/lib/prospect/constants'

export type ProspectSummaryInput = {
  state: string
  range: string
  marital: 'single' | 'married'
  businessOwner: boolean
  age: number
}

export type ProspectSummary = {
  assets: number
  federalTaxCurrent: number
  federalTaxSunset: number
  sunsetDelta: number
  stateTax: number
  exemptionCurrent: number
  exemptionSunset: number
  planningGaps: string[]
  whatWeWouldLookAt: string[]
  selectedState: string
}

async function loadStateBrackets(
  supabase: SupabaseClient,
  state: string,
  year: number,
): Promise<StateBracket[]> {
  const { data } = await supabase
    .from('state_estate_tax_rules')
    .select('min_amount, max_amount, rate_pct, exemption_amount')
    .eq('state', state)
    .eq('tax_year', year)
    .order('min_amount', { ascending: true })

  return (data ?? []).map((row) => ({
    min_amount: Number(row.min_amount),
    max_amount: Number(row.max_amount),
    rate_pct: Number(row.rate_pct),
    exemption_amount: Number(row.exemption_amount),
  }))
}

export function buildProspectSummary(
  input: ProspectSummaryInput,
  taxConfig: ProspectTaxConfig,
  stateBrackets: StateBracket[],
): ProspectSummary {
  const assets = PROSPECT_ASSET_MIDPOINTS[input.range] ?? 10_000_000
  const isMarried = input.marital === 'married'

  const exemptionCurrent = isMarried
    ? taxConfig.currentLaw.exemptionMarried
    : taxConfig.currentLaw.exemptionIndividual
  const exemptionSunset = isMarried
    ? taxConfig.sunset.exemptionMarried
    : taxConfig.sunset.exemptionIndividual

  const federalTaxCurrent = Math.round(
    Math.max(0, assets - exemptionCurrent) * (taxConfig.currentLaw.topRatePct / 100),
  )
  const federalTaxSunset = Math.round(
    Math.max(0, assets - exemptionSunset) * (taxConfig.sunset.topRatePct / 100),
  )
  const sunsetDelta = federalTaxSunset - federalTaxCurrent

  const stateTaxResult = calculateStateEstateTax(
    assets,
    input.state,
    stateBrackets,
    isMarried,
  )
  const stateTax = Math.round(stateTaxResult.stateTax)

  const planningGaps: string[] = []
  if (assets > exemptionSunset) {
    planningGaps.push('Estate may exceed federal exemption under sunset scenario')
  }
  if (isMarried && assets > 5_000_000) {
    planningGaps.push('Credit shelter trust opportunity at first death')
  }
  if (input.businessOwner) {
    planningGaps.push('Business succession and valuation planning needed')
  }
  if (assets > 10_000_000) {
    planningGaps.push('Annual gifting program could reduce estate over time')
  }
  if (stateTax > 0) {
    planningGaps.push(`${input.state} state estate tax applies — separate from federal`)
  }
  if (input.age > 60) {
    planningGaps.push('Beneficiary designation review recommended')
  }

  const lookAt: string[] = [
    'Review all beneficiary designations and account titling',
    'Analyze federal and state estate tax exposure under current and sunset law',
  ]
  if (isMarried) lookAt.push('Evaluate portability election and credit shelter trust')
  if (assets > 10_000_000) {
    lookAt.push('Annual gifting program and lifetime exemption utilization')
  }
  if (input.businessOwner) {
    lookAt.push('Business succession plan and valuation discount strategies')
  }
  if (sunsetDelta > 500_000) {
    lookAt.push('Sunset planning window — act before exemption reduction')
  }
  if (stateTax > 0) {
    lookAt.push(`${input.state} state estate tax mitigation strategies`)
  }

  return {
    assets,
    federalTaxCurrent,
    federalTaxSunset,
    sunsetDelta,
    stateTax,
    exemptionCurrent,
    exemptionSunset,
    planningGaps: planningGaps.slice(0, 5),
    whatWeWouldLookAt: lookAt.slice(0, 6),
    selectedState: input.state,
  }
}

export async function calculateProspectSummary(
  supabase: SupabaseClient,
  input: ProspectSummaryInput,
): Promise<ProspectSummary> {
  const [taxConfig, stateBrackets] = await Promise.all([
    getProspectTaxConfig(),
    loadStateBrackets(supabase, input.state, new Date().getFullYear()),
  ])

  return buildProspectSummary(input, taxConfig, stateBrackets)
}
