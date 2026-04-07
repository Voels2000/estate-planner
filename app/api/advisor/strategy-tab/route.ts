import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAccessContext } from '@/lib/access/getAccessContext'
import {
  computeEstateTaxProjection,
  buildScenarioComparison,
} from '@/lib/calculations/estate-tax-projection'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { user, isAdvisor, isSuperuser } = await getAccessContext()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdvisor && !isSuperuser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const clientId = sp.get('clientId')
  const sequenceParam = sp.get('sequence') ?? 'S1_first'

  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 })

  const supabase = await createClient()
  const admin = createAdminClient()

  // Verify advisor-client link
  const { data: link } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('advisor_id', user.id)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .single()

  if (!link && !isSuperuser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get household
  const { data: household } = await admin
    .from('households')
    .select('*, base_case_scenario_id')
    .eq('owner_id', clientId)
    .single()

  if (!household) return NextResponse.json({ error: 'no_scenario' }, { status: 404 })

  // Check for saved scenario
  const { data: savedScenario } = await admin
    .from('projection_scenarios')
    .select('*')
    .eq('household_id', household.id)
    .eq('scenario_type', 'base_case')
    .eq('status', 'saved')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!savedScenario) {
    return NextResponse.json({ error: 'no_scenario' }, { status: 404 })
  }

  // Get all active tax configs
  const { data: taxConfigs } = await admin
    .from('federal_tax_config')
    .select('*')
    .eq('is_active', true)

  if (!taxConfigs || taxConfigs.length === 0) {
    return NextResponse.json({ error: 'Tax config not found' }, { status: 500 })
  }

  // Build scenario summaries for all law scenarios
  const scenarioOutputs: Record<string, unknown> = {}

  for (const config of taxConfigs) {
    const { s1_first, s2_first } = computeEstateTaxProjection(
      savedScenario.outputs,
      config,
      household.filing_status === 'mfj' ? 'mfj' : 'single',
      household.has_spouse ?? false,
      household.person1_birth_year ?? 1960,
      household.person1_longevity_age ?? 90,
      household.person2_birth_year,
      household.person2_longevity_age,
      0, // simplified state rate for cross-scenario comparison
    )

    const seq = sequenceParam === 'S2_first' ? s2_first : s1_first
    if (seq) scenarioOutputs[config.scenario_id] = seq
  }

  const summaries = buildScenarioComparison(scenarioOutputs as never)

  // Return rows for selected sequence from current-law baseline
  const activeConfig = taxConfigs.find(c => c.scenario_id === 'current_law_extended')
  if (!activeConfig) {
    return NextResponse.json({ error: 'Active baseline tax config not found' }, { status: 500 })
  }

  const { s1_first, s2_first } = computeEstateTaxProjection(
    savedScenario.outputs,
    activeConfig,
    household.filing_status === 'mfj' ? 'mfj' : 'single',
    household.has_spouse ?? false,
    household.person1_birth_year ?? 1960,
    household.person1_longevity_age ?? 90,
    household.person2_birth_year,
    household.person2_longevity_age,
    0,
  )

  const rows = sequenceParam === 'S2_first' ? s2_first?.rows ?? [] : s1_first.rows

  return NextResponse.json({ rows, summaries })
}
