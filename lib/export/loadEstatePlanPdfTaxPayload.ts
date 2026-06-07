import type { SupabaseClient } from '@supabase/supabase-js'
import type { StateBracket } from '@/lib/calculations/stateEstateTax'
import { deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import { latestFederalBracketsFromRows } from '@/lib/tax/federalExportTax'
import {
  buildEstatePlanPdfTaxPayload,
  type EstatePlanPdfTaxPayload,
} from '@/lib/export/buildEstatePlanPdfTaxPayload'

function mapStateBracketRows(rows: Array<Record<string, unknown>>): StateBracket[] {
  return rows.map((r) => ({
    min_amount: Number(r.min_amount),
    max_amount: r.max_amount != null ? Number(r.max_amount) : 9_999_999_999,
    rate_pct: Number(r.rate_pct),
    exemption_amount: Number(r.exemption_amount ?? 0),
  }))
}

/** Engine B tax payload for estate-plan PDF export API. */
export async function loadEstatePlanPdfTaxPayload(
  supabase: SupabaseClient,
  householdId: string,
  household: {
    filing_status?: string | null
    has_spouse?: boolean | null
    state_primary?: string | null
  },
): Promise<EstatePlanPdfTaxPayload> {
  const currentYear = new Date().getFullYear()
  const statePrimary = String(household.state_primary ?? '').trim().toUpperCase()

  const [giftingRes, federalBracketsRes, strategyRowsRes, stateRulesRes] = await Promise.all([
    supabase.rpc('calculate_gifting_summary', { p_household_id: householdId }),
    supabase
      .from('federal_estate_tax_brackets')
      .select('tax_year, min_amount, max_amount, rate_pct')
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true }),
    supabase
      .from('strategy_line_items')
      .select('strategy_source, consumer_accepted, consumer_rejected, source_role, is_active')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .is('projection_year', null),
    statePrimary
      ? supabase
          .from('state_estate_tax_rules')
          .select('min_amount, max_amount, rate_pct, exemption_amount')
          .eq('state', statePrimary)
          .eq('tax_year', currentYear)
          .order('min_amount', { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[], error: null }),
  ])

  const lifetimeGiftsUsed = Math.max(
    0,
    Number(
      (giftingRes.data as { lifetime_exemption_used?: number } | null)?.lifetime_exemption_used ?? 0,
    ),
  )

  let stateBrackets = mapStateBracketRows(stateRulesRes.data ?? [])
  if (statePrimary && stateBrackets.length === 0) {
    const fallback = await supabase
      .from('state_estate_tax_rules')
      .select('min_amount, max_amount, rate_pct, exemption_amount')
      .eq('state', statePrimary)
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true })
      .limit(20)
    stateBrackets = mapStateBracketRows(fallback.data ?? [])
  }

  const composition = await getCachedComposition(
    supabase,
    householdId,
    'consumer',
    lifetimeGiftsUsed,
  )
  const federalBrackets = latestFederalBracketsFromRows(federalBracketsRes.data ?? [])
  const hasBypassTrust = deriveHasBypassTrustFromLineItems(
    strategyRowsRes.data ?? [],
    'consumer_accepted',
  )

  return buildEstatePlanPdfTaxPayload({
    household,
    composition,
    federalBrackets,
    stateBrackets,
    lifetimeGiftsUsed,
    hasBypassTrust,
  })
}
