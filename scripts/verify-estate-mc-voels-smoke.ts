/**
 * Voels estate MC engine B smoke — POST shape + edge call + horizon alignment at gross estate.
 * Run: dotenv -e .env.local -- npx tsx scripts/verify-estate-mc-voels-smoke.ts
 *
 * Optional: PLAYWRIGHT_ADVISOR_EMAIL + PLAYWRIGHT_ADVISOR_PASSWORD in env for edge JWT.
 */

import { createClient } from '@supabase/supabase-js'
import { buildAdvisorStrategyViewModels } from '@/lib/advisor/strategyMappers'
import { getCachedComposition } from '@/lib/estate/getCachedComposition'
import {
  fetchStrategyLineItemsWithClient,
  strategyLineItemsForHorizons,
} from '@/lib/estate/strategyLedger'
import { deriveHasBypassTrustFromLineItems } from '@/lib/constants/strategyTypes'
import { isMFJFilingStatus, calculateStateEstateTax, resolveActiveStateTax } from '@/lib/calculations/stateEstateTax'
import { runEstateMonteCarlo } from '@/lib/calculations/estate-monte-carlo'
import type { StateBracket } from '@/lib/calculations/stateEstateTax'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function findVoelsClient() {
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, email')
    .or('full_name.ilike.%voel%,email.ilike.%voel%')
    .limit(10)

  for (const p of profiles ?? []) {
    const { data: link } = await admin
      .from('advisor_clients')
      .select('advisor_id, status')
      .eq('client_id', p.id)
      .in('status', ['active', 'connected'])
      .maybeSingle()
    if (link?.advisor_id) {
      return {
        clientId: p.id,
        advisorId: link.advisor_id,
        label: p.full_name ?? p.email ?? p.id,
      }
    }
  }
  return null
}

function buildHasBypassTrust(
  advisorItems: Awaited<ReturnType<typeof fetchStrategyLineItemsWithClient>>,
  consumerItems: Awaited<ReturnType<typeof fetchStrategyLineItemsWithClient>>,
) {
  const activeAdvisor = advisorItems.filter((item) => !item.consumer_rejected)
  const actualStrategyLineItems = [
    ...consumerItems.map((item) => ({
      strategy_source: item.strategy_source,
      source_role: 'consumer' as const,
      consumer_accepted: true,
      is_active: item.is_active ?? true,
      consumer_rejected: false,
    })),
    ...activeAdvisor
      .filter((item) => item.consumer_accepted)
      .map((item) => ({
        strategy_source: item.strategy_source,
        source_role: item.source_role,
        consumer_accepted: item.consumer_accepted,
        is_active: item.is_active ?? true,
        consumer_rejected: item.consumer_rejected,
      })),
  ]
  return deriveHasBypassTrustFromLineItems(actualStrategyLineItems, 'consumer_accepted')
}

async function advisorAccessToken(advisorId: string): Promise<string | null> {
  const profileEmail = (
    await admin.from('profiles').select('email').eq('id', advisorId).maybeSingle()
  ).data?.email

  // SMOKE_ADVISOR_PASSWORD without email → use linked advisor profile (e.g. Voels)
  const email =
    process.env.SMOKE_ADVISOR_EMAIL ??
    (process.env.SMOKE_ADVISOR_PASSWORD ? profileEmail : null) ??
    process.env.PLAYWRIGHT_ADVISOR_EMAIL ??
    profileEmail

  const password = process.env.SMOKE_ADVISOR_PASSWORD ?? process.env.PLAYWRIGHT_ADVISOR_PASSWORD
  if (!email || !password) {
    console.warn('No advisor password in env — skipping live edge call (set PLAYWRIGHT_ADVISOR_* or SMOKE_ADVISOR_*)')
    return null
  }

  const authClient = createClient(url!, anonKey!, { auth: { persistSession: false } })
  const { data, error } = await authClient.auth.signInWithPassword({ email, password })
  if (error || !data.session?.access_token) {
    console.warn(`Advisor sign-in failed for ${email}:`, error?.message ?? 'no session')
    return null
  }
  if (data.user?.id !== advisorId) {
    console.warn(
      `Signed-in user ${data.user?.id} is not Voels advisor ${advisorId} — edge call may 403; trying anyway`,
    )
  }
  return data.session.access_token
}

async function main() {
  const target = await findVoelsClient()
  if (!target) {
    console.error('No Voels client/advisor pair found')
    process.exit(1)
  }

  const { data: household } = await admin
    .from('households')
    .select(
      'id, owner_id, has_spouse, state_primary, filing_status, person1_birth_year, base_case_scenario_id, growth_rate_accumulation',
    )
    .eq('owner_id', target.clientId)
    .maybeSingle()

  if (!household) {
    console.error('No household')
    process.exit(1)
  }

  const currentYear = new Date().getFullYear()
  const stateCode = household.state_primary ?? 'WA'

  const { data: bracketRows } = await admin
    .from('state_estate_tax_rules')
    .select('min_amount, max_amount, rate_pct, exemption_amount')
    .eq('state', stateCode)
    .eq('tax_year', currentYear)
    .order('min_amount', { ascending: true })

  const stateBrackets = (bracketRows ?? []) as StateBracket[]

  const [advisorItems, consumerItems, composition, scenarioRes] = await Promise.all([
    fetchStrategyLineItemsWithClient(admin, household.id, 'advisor'),
    fetchStrategyLineItemsWithClient(admin, household.id, 'consumer'),
    getCachedComposition(admin, household.id),
    household.base_case_scenario_id
      ? admin.from('projection_scenarios').select('*').eq('id', household.base_case_scenario_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const strategyLineItems = strategyLineItemsForHorizons(advisorItems, consumerItems)
  const hasBypassTrust = buildHasBypassTrust(advisorItems, consumerItems)
  const filingStatus = isMFJFilingStatus(household.filing_status) ? 'mfj' : 'single'

  const scenario = scenarioRes.data
  const { data: outputs } = scenario?.id
    ? await admin
        .from('projection_outputs')
        .select('*')
        .eq('scenario_id', scenario.id)
        .order('year', { ascending: true })
    : { data: [] }

  const latestOutput = outputs?.length ? outputs[outputs.length - 1] : null
  const outputsFirst = outputs?.filter((r) => (r as { death_order?: string }).death_order === 'first') ?? []
  const outputsSecond =
    outputs?.filter((r) => (r as { death_order?: string }).death_order === 'second') ?? []

  const strategyVm = buildAdvisorStrategyViewModels({
    currentYear,
    household,
    stateBrackets,
    estateCompositionGrossEstate: Number(composition?.gross_estate ?? 0),
    lifetimeGiftsUsed: 0,
    scenario,
    scenarioOutputs: outputsFirst as Record<string, unknown>[],
    scenarioOutputsSecondDeath: outputsSecond as Record<string, unknown>[],
    latestOutput: latestOutput as Record<string, unknown> | null,
    assumptionSnapshot: {},
    strategyLineItems,
  })

  const today = strategyVm.advisorHorizons.today
  const grossEstate = Number(today.grossEstate ?? 0)
  const federalExemption = Number(today.federalExemption ?? 0)
  const todayStateTax = Number(today.stateTax ?? 0)

  const person1BirthYear = household.person1_birth_year ?? 1960
  const currentAge = currentYear - person1BirthYear
  const yearsUntilDeath = Math.max(5, 85 - currentAge)

  const postBody = {
    householdId: household.id,
    scenarioId: scenario?.id ?? undefined,
    grossEstate,
    federalExemption,
    stateCode,
    stateBrackets,
    filingStatus,
    hasBypassTrust,
    yearsUntilDeath,
    strategyEstateReduction: 0,
    lawScenario: 'current_law',
    simulationCount: 500,
  }

  console.log('\n=== Voels Estate MC Smoke ===')
  console.log(`Client: ${target.label}`)
  console.log(`State: ${stateCode} | MFJ: ${filingStatus === 'mfj'} | hasBypassTrust: ${hasBypassTrust}`)
  console.log(`Gross estate (today): $${Math.round(grossEstate).toLocaleString()}`)
  console.log(`Today state tax (horizons): $${Math.round(todayStateTax).toLocaleString()}`)
  console.log(`stateBrackets rows: ${stateBrackets.length}`)

  const postJson = JSON.stringify(postBody)
  const hasFlatRate = postJson.includes('stateEstateTaxRate')
  console.log(`\nPOST body contains stateEstateTaxRate: ${hasFlatRate ? 'FAIL' : 'PASS'}`)
  console.log(`POST stateBrackets non-empty: ${stateBrackets.length > 0 ? 'PASS' : 'FAIL'}`)
  if (stateBrackets.length > 0) {
    console.log(
      `  First bracket: min=${stateBrackets[0].min_amount} rate=${stateBrackets[0].rate_pct}% exemption=${stateBrackets[0].exemption_amount}`,
    )
  }

  const engineAtGross = resolveActiveStateTax(
    calculateStateEstateTax(grossEstate, stateCode, stateBrackets, filingStatus === 'mfj', false),
    hasBypassTrust,
  )
  const engineDelta = Math.abs(engineAtGross - todayStateTax)
  console.log(`\nEngine B at gross estate: $${Math.round(engineAtGross).toLocaleString()}`)
  console.log(`Delta vs horizons today.stateTax: $${Math.round(engineDelta).toLocaleString()} (${engineDelta < 5000 ? 'PASS' : 'CHECK'})`)

  const libResult = runEstateMonteCarlo({
    ...postBody,
    baseGrowthRate: 0.07,
    strategyEstatereduction: 0,
    includeSensitivity: false,
  })
  console.log(`\nLib MC (500 paths):`)
  console.log(`  P50 estate: $${libResult.p50_estate.toLocaleString()}`)
  console.log(`  P50 tax:    $${libResult.p50_tax.toLocaleString()}`)
  console.log(`  Fan chart points: ${libResult.fan_chart_data.length}`)

  const p50Ratio = libResult.p50_estate > 0 ? libResult.p50_tax / libResult.p50_estate : 0
  const todayRatio = grossEstate > 0 ? todayStateTax / grossEstate : 0
  console.log(`  P50 effective rate: ${(p50Ratio * 100).toFixed(2)}% | Today: ${(todayRatio * 100).toFixed(2)}%`)

  const token = await advisorAccessToken(target.advisorId)
  if (token) {
    const res = await fetch(`${url}/functions/v1/estate-monte-carlo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey!,
      },
      body: postJson,
    })
    const text = await res.text()
    console.log(`\nEdge POST: HTTP ${res.status}`)
    if (!res.ok) {
      console.error(text.slice(0, 500))
      process.exit(1)
    }
    const edge = JSON.parse(text) as { p50_tax?: number; p50_estate?: number; fan_chart_data?: unknown[] }
    console.log(`  P50 estate: $${Number(edge.p50_estate ?? 0).toLocaleString()}`)
    console.log(`  P50 tax:    $${Number(edge.p50_tax ?? 0).toLocaleString()}`)
    console.log(`  Fan chart points: ${edge.fan_chart_data?.length ?? 0}`)

    const edgeP50Tax = Number(edge.p50_tax ?? 0)
    const ballparkLow = todayStateTax * 0.5
    const ballparkHigh = todayStateTax * 2.5
    const inBallpark = edgeP50Tax >= ballparkLow && edgeP50Tax <= ballparkHigh
    console.log(
      `\nP50 tax ballpark vs today ($${Math.round(todayStateTax).toLocaleString()}): ${
        inBallpark ? 'PASS (within 0.5×–2.5×)' : 'CHECK'
      }`,
    )
    console.log('  (P50 tax is on simulated P50 estate, not today gross — wide band expected)')
  }

  if (hasFlatRate || stateBrackets.length === 0) process.exit(1)
  console.log('\nSmoke checks complete.\n')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
