import { createClient } from '@/lib/supabase/server'
import { OBBBA_2026 } from '@/lib/tax/estate-tax-constants'

export interface ProspectTaxConfig {
  currentLaw: {
    exemptionIndividual: number
    exemptionMarried: number
    topRatePct: number
  }
  sunset: {
    exemptionIndividual: number
    exemptionMarried: number
    topRatePct: number
  }
  annualGiftExclusion: number
}

/** TCJA pre-sunset baseline — used when `sunset_2026` row is absent from DB. */
const SUNSET_FALLBACK = {
  exemptionIndividual: 7_000_000,
  exemptionMarried: 14_000_000,
  topRatePct: 40,
} as const

export async function getProspectTaxConfig(): Promise<ProspectTaxConfig> {
  const supabase = await createClient()

  const { data: configs } = await supabase
    .from('federal_tax_config')
    .select(
      'scenario_id, estate_exemption_individual, estate_exemption_married, estate_top_rate_pct, annual_gift_exclusion',
    )
    .in('scenario_id', ['current_law', 'sunset_2026'])

  const current = configs?.find((c) => c.scenario_id === 'current_law')
  const sunset = configs?.find((c) => c.scenario_id === 'sunset_2026')

  return {
    currentLaw: {
      exemptionIndividual:
        current?.estate_exemption_individual ?? OBBBA_2026.BASIC_EXCLUSION_SINGLE,
      exemptionMarried:
        current?.estate_exemption_married ?? OBBBA_2026.BASIC_EXCLUSION_MFJ,
      topRatePct: current?.estate_top_rate_pct ?? OBBBA_2026.TOP_RATE * 100,
    },
    sunset: {
      exemptionIndividual:
        sunset?.estate_exemption_individual ?? SUNSET_FALLBACK.exemptionIndividual,
      exemptionMarried:
        sunset?.estate_exemption_married ?? SUNSET_FALLBACK.exemptionMarried,
      topRatePct: sunset?.estate_top_rate_pct ?? SUNSET_FALLBACK.topRatePct,
    },
    annualGiftExclusion:
      current?.annual_gift_exclusion ?? OBBBA_2026.ANNUAL_GIFT_EXCLUSION,
  }
}
