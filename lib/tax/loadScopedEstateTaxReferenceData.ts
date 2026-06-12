import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Load federal + state estate/inheritance tax reference rows for a household.
 * Matches client-side filtering in EstateTaxClient (latest year + state_primary)
 * without fetching all states/years.
 */
export async function loadScopedEstateTaxReferenceData(
  supabase: SupabaseClient,
  statePrimary: string | null | undefined,
  taxYear: number = new Date().getFullYear(),
) {
  const stateCode = String(statePrimary ?? '').trim().toUpperCase()

  const federalPromise = supabase
    .from('federal_estate_tax_brackets')
    .select('*')
    .eq('tax_year', taxYear)
    .order('min_amount', { ascending: true })

  const [federalRes, stateEstateRes, stateInheritanceRes] = await Promise.all([
    federalPromise,
    stateCode
      ? supabase
          .from('state_estate_tax_rules')
          .select('*')
          .eq('state', stateCode)
          .eq('tax_year', taxYear)
          .order('min_amount', { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    stateCode
      ? supabase
          .from('state_inheritance_tax_rules')
          .select('*')
          .eq('state', stateCode)
          .eq('tax_year', taxYear)
          .order('beneficiary_class', { ascending: true })
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ])

  let federalEstateTaxBracketsRows = federalRes.data ?? []
  let stateEstateTaxRows = stateEstateRes.data ?? []
  let stateInheritanceTaxRows = stateInheritanceRes.data ?? []

  // Fallback: prior tax year for this state/federal if current year not seeded yet.
  if (federalEstateTaxBracketsRows.length === 0) {
    const { data } = await supabase
      .from('federal_estate_tax_brackets')
      .select('*')
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true })
      .limit(20)
    federalEstateTaxBracketsRows = data ?? []
  }

  if (stateCode && stateEstateTaxRows.length === 0) {
    const { data } = await supabase
      .from('state_estate_tax_rules')
      .select('*')
      .eq('state', stateCode)
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true })
    stateEstateTaxRows = data ?? []
  }

  if (stateCode && stateInheritanceTaxRows.length === 0) {
    const { data } = await supabase
      .from('state_inheritance_tax_rules')
      .select('*')
      .eq('state', stateCode)
      .order('tax_year', { ascending: false })
    stateInheritanceTaxRows = data ?? []
  }

  return {
    federalEstateTaxBracketsRows,
    stateEstateTaxRows,
    stateInheritanceTaxRows,
  }
}
