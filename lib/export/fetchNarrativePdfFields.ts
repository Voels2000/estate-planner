/**
 * Parallel fetch of narrative-engine inputs for PDFReportData.
 */

import { CST_STRATEGY_SOURCES, deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { createClient } from '@/lib/supabase/server'

export type NarrativePdfFields = {
  filingStatus: 'mfj' | 'single' | 'widow'
  domicileState: string
  hasTrust: boolean
  hasIrrevocableTrust: boolean
  hasBypassTrust: boolean
  hasGiftingProgram: boolean
  lifeInsuranceOutsideILIT: number
  priorHealthScore?: number
  sunsetTaxEstimate: number
  annualGiftingCapacity: number
  lifetimeExemptionRemaining: number
}

export function normalizePdfFilingStatus(raw: string | null | undefined): 'mfj' | 'single' | 'widow' {
  const n = (raw ?? '').toLowerCase()
  if (['mfj', 'married_joint', 'married_filing_jointly', 'joint'].includes(n)) return 'mfj'
  if (['qw', 'qualifying_widow', 'widow'].includes(n)) return 'widow'
  return 'single'
}

export async function fetchNarrativePdfFields(params: {
  householdId: string
  clientId: string
  grossEstate: number
  filingStatus: string | null
  statePrimary: string | null
}): Promise<NarrativePdfFields> {
  const supabase = await createClient()
  const filingStatus = normalizePdfFilingStatus(params.filingStatus)

  const [trustRes, irrevocableRes, cstLineRes, giftingRes, insuranceRes, priorScoreRes, giftingSummaryRes] =
    await Promise.all([
      supabase
        .from('estate_documents')
        .select('id')
        .eq('owner_id', params.clientId)
        .eq('document_type', 'trust')
        .eq('exists', true)
        .limit(1),
      supabase
        .from('strategy_configs')
        .select('id')
        .eq('household_id', params.householdId)
        .eq('is_active', true)
        .in('strategy_type', ['ilit', 'slat', 'grat'])
        .limit(1),
      supabase
        .from('strategy_line_items')
        .select('strategy_source, source_role, consumer_accepted, consumer_rejected, is_active')
        .eq('household_id', params.householdId)
        .in('strategy_source', [...CST_STRATEGY_SOURCES])
        .eq('is_active', true),
      supabase
        .from('strategy_configs')
        .select('id')
        .eq('household_id', params.householdId)
        .eq('is_active', true)
        .in('strategy_type', ['gifting', 'annual_gifting'])
        .limit(1),
      supabase
        .from('insurance_policies')
        .select('death_benefit, is_ilit')
        .eq('user_id', params.clientId),
      supabase
        .from('estate_health_scores')
        .select('score')
        .eq('household_id', params.householdId)
        .order('computed_at', { ascending: false })
        .range(1, 1),
      supabase.rpc('calculate_gifting_summary', { p_household_id: params.householdId }),
    ])

  const sunsetExempt = filingStatus === 'mfj' ? 14_000_000 : 7_000_000
  const taxable = Math.max(0, params.grossEstate - sunsetExempt)
  const sunsetTaxEstimate = taxable > 0 ? Math.round(taxable * 0.40) : 0

  const giftingData = giftingSummaryRes.data as { lifetime_remaining?: number } | null
  const fullExempt = filingStatus === 'mfj' ? 27_980_000 : 13_990_000
  const lifetimeExemptionRemaining =
    giftingData?.lifetime_remaining != null
      ? Number(giftingData.lifetime_remaining)
      : Math.max(0, fullExempt - params.grossEstate)

  const lifeInsuranceOutsideILIT = (insuranceRes.data ?? [])
    .filter((p) => !p.is_ilit)
    .reduce((sum, p) => sum + Number(p.death_benefit ?? 0), 0)

  const hasBypassTrust = deriveHasBypassTrustFromLineItems(cstLineRes.data ?? [], 'consumer_accepted')

  return {
    filingStatus,
    domicileState: params.statePrimary ?? 'WA',
    hasTrust: (trustRes.data?.length ?? 0) > 0,
    hasIrrevocableTrust: (irrevocableRes.data?.length ?? 0) > 0,
    hasBypassTrust,
    hasGiftingProgram: (giftingRes.data?.length ?? 0) > 0,
    lifeInsuranceOutsideILIT,
    priorHealthScore: priorScoreRes.data?.[0]?.score ?? undefined,
    sunsetTaxEstimate,
    annualGiftingCapacity: filingStatus === 'mfj' ? 38_000 : 19_000,
    lifetimeExemptionRemaining,
  }
}
