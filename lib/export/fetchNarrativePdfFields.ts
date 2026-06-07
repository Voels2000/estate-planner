/**
 * Parallel fetch of narrative-engine inputs for PDFReportData.
 */

import { CST_STRATEGY_SOURCES, deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { createClient } from '@/lib/supabase/server'
import { normalizePdfFilingStatus, type PdfFilingStatus } from '@/lib/export/pdfFilingStatus'
import {
  computeFederalExportTax,
  federalTaxSavedByReduction,
  latestFederalBracketsFromRows,
} from '@/lib/tax/federalExportTax'

export type { PdfFilingStatus }
export { normalizePdfFilingStatus }

export type NarrativePdfFields = {
  filingStatus: PdfFilingStatus
  domicileState: string
  hasTrust: boolean
  hasIrrevocableTrust: boolean
  hasBypassTrust: boolean
  hasGiftingProgram: boolean
  lifeInsuranceOutsideILIT: number
  priorHealthScore?: number
  sunsetTaxEstimate: number
  ilitTaxSavingsEstimate: number
  annualGiftingCapacity: number
  lifetimeExemptionRemaining: number
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

  const [trustRes, irrevocableRes, cstLineRes, giftingRes, insuranceRes, priorScoreRes, giftingSummaryRes, federalBracketsRes] =
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
      supabase
        .from('federal_estate_tax_brackets')
        .select('tax_year, min_amount, max_amount, rate_pct')
        .order('tax_year', { ascending: false })
        .order('min_amount', { ascending: true }),
    ])

  const federalBrackets = latestFederalBracketsFromRows(federalBracketsRes.data ?? [])
  const hasSpouse = filingStatus === 'mfj'
  const sunsetTaxEstimate = computeFederalExportTax({
    grossEstate: params.grossEstate,
    filingStatus,
    hasSpouse,
    brackets: federalBrackets,
    lawScenario: 'no_exemption',
  }).federalTax

  const giftingData = giftingSummaryRes.data as { lifetime_remaining?: number } | null
  const fullExempt = filingStatus === 'mfj' ? 27_980_000 : 13_990_000
  const lifetimeExemptionRemaining =
    giftingData?.lifetime_remaining != null
      ? Number(giftingData.lifetime_remaining)
      : Math.max(0, fullExempt - params.grossEstate)

  const lifeInsuranceOutsideILIT = (insuranceRes.data ?? [])
    .filter((p) => !p.is_ilit)
    .reduce((sum, p) => sum + Number(p.death_benefit ?? 0), 0)

  const ilitTaxSavingsEstimate =
    federalBrackets.length > 0
      ? federalTaxSavedByReduction(params.grossEstate, lifeInsuranceOutsideILIT, {
          filingStatus,
          hasSpouse,
          brackets: federalBrackets,
        })
      : Math.round(lifeInsuranceOutsideILIT * 0.4)

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
    ilitTaxSavingsEstimate,
    annualGiftingCapacity: filingStatus === 'mfj' ? 38_000 : 19_000,
    lifetimeExemptionRemaining,
  }
}
