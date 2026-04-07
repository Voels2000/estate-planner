'use server'

// lib/actions/generate-base-case.ts
// Generates the base case projection scenario and saves to projection_scenarios (Sprint 59)

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeCompleteProjection } from '@/lib/calculations/projection-complete'
import { computeEstateTaxProjection } from '@/lib/calculations/estate-tax-projection'
import type { AssumptionSnapshot } from '@/lib/types/projection-scenario'
import type {
  AssetRowSelect,
  LiabilityRowSelect,
  IncomeRowSelect,
  ExpenseRowSelect,
} from '@/lib/types/planner-rows'

export async function generateBaseCase(householdId: string): Promise<{
  scenarioId: string
  score: number
} | { error: string }> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: 'Unauthorized' }

    // Fetch all required data in parallel
    const [
      { data: household },
      { data: assets },
      { data: liabilities },
      { data: income },
      { data: expenses },
      { data: irmaa_brackets },
      { data: real_estate },
      { data: state_income_tax_rates },
      { data: taxConfigs },
    ] = await Promise.all([
      admin.from('households').select('*').eq('id', householdId).single(),
      admin
        .from('assets')
        .select('id, type, value, owner, cost_basis, basis_date, titling, liquidity')
        .eq('owner_id', user.id),
      admin
        .from('liabilities')
        .select('id, type, balance, monthly_payment, interest_rate, owner')
        .eq('owner_id', user.id),
      admin
        .from('income')
        .select('id, source, amount, start_year, end_year, inflation_adjust, ss_person')
        .eq('owner_id', user.id),
      admin
        .from('expenses')
        .select('id, category, amount, start_year, end_year, inflation_adjust, owner')
        .eq('owner_id', user.id),
      admin
        .from('irmaa_brackets')
        .select('magi_threshold, part_b_surcharge, part_d_surcharge, filing_status')
        .order('tax_year', { ascending: false })
        .limit(20),
      admin
        .from('real_estate')
        .select('id, name, current_value, is_primary_residence, owner')
        .eq('owner_id', user.id),
      admin
        .from('state_income_tax_rates')
        .select('state_code, rate_pct, tax_year')
        .order('tax_year', { ascending: false }),
      admin.from('federal_tax_config').select('*').eq('is_active', true),
    ])

    if (!household) return { error: 'Household not found' }

    // Run income projection engine
    const projectionRows = computeCompleteProjection({
      household,
      assets: (assets ?? []) as AssetRowSelect[],
      liabilities: (liabilities ?? []) as LiabilityRowSelect[],
      income: (income ?? []) as unknown as IncomeRowSelect[],
      expenses: (expenses ?? []) as ExpenseRowSelect[],
      irmaa_brackets: irmaa_brackets ?? [],
      real_estate: (real_estate ?? []) as {
        id: string
        name: string
        current_value: number
        is_primary_residence: boolean
        owner: string
      }[],
      state_income_tax_rates: state_income_tax_rates ?? [],
    })

    // State estate tax rate - use flat approximation until RPC is wired
    // Sprint 59 locked decision: calls calculate_state_estate_tax for current year
    const { data: stateEstateTax } = await admin
      .rpc('calculate_state_estate_tax', { p_household_id: householdId })
      .maybeSingle()

    const stateEstateTaxRate = stateEstateTax
      ? (stateEstateTax.state_estate_tax ?? 0) /
        Math.max(1, projectionRows[projectionRows.length - 1]?.estate_incl_home ?? 1)
      : 0

    // Run estate tax projection for all 3 scenarios
    const currentLawConfig = taxConfigs?.find(c => c.scenario_id === 'current_law_extended')
    const sunsetConfig = taxConfigs?.find(c => c.scenario_id === 'sunset_2026')
    const legislativeConfig = taxConfigs?.find(c => c.scenario_id === 'legislative_change')

    if (!currentLawConfig) return { error: 'Tax config not found - run Sprint 57 SQL' }
    void sunsetConfig
    void legislativeConfig

    const filingStatus =
      household.filing_status === 'mfj' || household.filing_status === 'married_filing_jointly'
        ? 'mfj'
        : 'single'

    const { s1_first, s2_first } = computeEstateTaxProjection(
      projectionRows,
      currentLawConfig,
      filingStatus,
      household.has_spouse ?? false,
      household.person1_birth_year ?? 1960,
      household.person1_longevity_age ?? 90,
      household.person2_birth_year,
      household.person2_longevity_age,
      stateEstateTaxRate,
    )

    // Build assumption snapshot
    const totalAssets = (assets ?? []).reduce((sum, a) => sum + Number(a.value ?? 0), 0)
    const totalLiabilities = (liabilities ?? []).reduce(
      (sum, l) => sum + Number(l.balance ?? 0),
      0,
    )

    const assumptionSnapshot: AssumptionSnapshot = {
      person1_birth_year: household.person1_birth_year,
      person1_retirement_age: household.person1_retirement_age,
      person1_ss_claiming_age: household.person1_ss_claiming_age,
      person1_longevity_age: household.person1_longevity_age,
      person2_birth_year: household.person2_birth_year,
      person2_retirement_age: household.person2_retirement_age,
      person2_ss_claiming_age: household.person2_ss_claiming_age,
      person2_longevity_age: household.person2_longevity_age,
      has_spouse: household.has_spouse ?? false,
      filing_status: household.filing_status ?? 'single',
      state_primary: household.state_primary,
      inflation_rate: household.inflation_rate ?? 2.5,
      growth_rate_accumulation: household.growth_rate_accumulation ?? 7,
      growth_rate_retirement: household.growth_rate_retirement ?? 5,
      tax_scenario: 'current_law_extended',
      estate_exemption_individual: currentLawConfig.estate_exemption_individual,
      estate_exemption_married: currentLawConfig.estate_exemption_married,
      estate_top_rate_pct: currentLawConfig.estate_top_rate_pct,
      annual_gift_exclusion: currentLawConfig.annual_gift_exclusion,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      calculated_at: new Date().toISOString(),
    }

    // Upsert projection scenario
    const now = new Date().toISOString()
    const label = `Base Case - ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`

    const { data: existing } = await admin
      .from('projection_scenarios')
      .select('id, version')
      .eq('household_id', householdId)
      .eq('scenario_type', 'base_case')
      .eq('status', 'saved')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextVersion = (existing?.version ?? 0) + 1

    const { data: savedScenario, error: saveError } = await admin
      .from('projection_scenarios')
      .insert({
        household_id: householdId,
        created_by: user.id,
        label,
        version: nextVersion,
        scenario_type: 'base_case',
        assumption_snapshot: assumptionSnapshot,
        outputs: s1_first.rows,
        outputs_s1_first: s1_first.rows,
        outputs_s2_first: s2_first?.rows ?? null,
        status: 'saved',
        calculated_at: now,
        updated_at: now,
      })
      .select('id')
      .single()

    if (saveError || !savedScenario) {
      return { error: saveError?.message ?? 'Failed to save scenario' }
    }

    // Update household.base_case_scenario_id
    await admin
      .from('households')
      .update({ base_case_scenario_id: savedScenario.id })
      .eq('id', householdId)

    return { scenarioId: savedScenario.id, score: 100 }
  } catch (err) {
    console.error('[generate-base-case] error:', err)
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
