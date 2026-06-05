/**
 * Smoke: MC precompute write path for Alan Voels (same fn the generateBaseCase hook calls).
 * Run: dotenv -e .env.local -- npx tsx scripts/smoke-mc-precompute-voels.ts
 */

import { createClient } from '@supabase/supabase-js'
import { runEstateMonteCarloAsync } from '@/lib/actions/run-estate-monte-carlo-async'
import { loadScenarioMonteCarlo } from '@/lib/advisor/loadScenarioMonteCarlo'

const VOELS_HOUSEHOLD_ID = '5ea14f56-e880-4992-87bc-0d815a450cdc'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function queryMcForScenario(scenarioId: string | null) {
  if (!scenarioId) return null
  const { data, error } = await admin
    .from('monte_carlo_results')
    .select(
      'scenario_id, mc_calculated_at, engine_version, percentiles_by_year, assumption_hash, p50_estate, p50_tax, created_at',
    )
    .eq('scenario_id', scenarioId)
    .maybeSingle()
  if (error) throw error
  return data
}

async function main() {
  const { data: household, error: hhErr } = await admin
    .from('households')
    .select('id, base_case_scenario_id')
    .eq('id', VOELS_HOUSEHOLD_ID)
    .single()

  if (hhErr || !household?.base_case_scenario_id) {
    console.error('Voels household or base_case_scenario_id not found', hhErr?.message)
    process.exit(1)
  }

  const scenarioId = household.base_case_scenario_id
  console.log('Household:', household.id)
  console.log('Base case scenario:', scenarioId)

  const before = await queryMcForScenario(scenarioId)
  console.log('\nBefore:', before ? `p50_estate=${before.p50_estate} band_years=${Array.isArray(before.percentiles_by_year) ? before.percentiles_by_year.length : 'null'}` : 'no row')

  console.log('\nRunning runEstateMonteCarloAsync (generateBaseCase hook target)...')
  const t0 = Date.now()
  await runEstateMonteCarloAsync(VOELS_HOUSEHOLD_ID, scenarioId, admin)
  console.log(`Done in ${Date.now() - t0}ms`)

  let after = await queryMcForScenario(scenarioId)
  for (let i = 0; i < 5 && !after?.assumption_hash; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    after = await queryMcForScenario(scenarioId)
  }

  const bandYears = Array.isArray(after?.percentiles_by_year)
    ? after.percentiles_by_year.length
    : null

  console.log('\n=== Smoke result ===')
  console.log('scenario_id:', after?.scenario_id)
  console.log('mc_calculated_at:', after?.mc_calculated_at)
  console.log('engine_version:', after?.engine_version)
  console.log('band_years:', bandYears)
  console.log('assumption_hash:', after?.assumption_hash ? `${after.assumption_hash.slice(0, 16)}...` : null)
  console.log('p50_estate:', after?.p50_estate)
  console.log('p50_tax:', after?.p50_tax)

  const ok =
    after?.engine_version === 'engine-b-v1' &&
    bandYears != null &&
    bandYears >= 5 &&
    bandYears <= 35 &&
    Boolean(after?.assumption_hash) &&
    Number(after?.p50_estate ?? 0) > 1_000_000 &&
    Number(after?.p50_tax ?? 0) > 100_000

  if (!ok) {
    console.error('\nSMOKE FAILED')
    process.exit(1)
  }

  const loaded = await loadScenarioMonteCarlo(scenarioId, admin)
  const loadedBands = loaded?.percentiles_by_year?.length ?? 0
  console.log('\n=== loadScenarioMonteCarlo ===')
  console.log('scenario_id:', loaded?.scenario_id)
  console.log('percentiles_by_year entries:', loadedBands)
  console.log('engine_version:', loaded?.engine_version)

  if (!loaded || loadedBands !== 25) {
    console.error('\nLOADER SMOKE FAILED')
    process.exit(1)
  }
  console.log('\nLOADER SMOKE PASSED')
  console.log('\nSMOKE PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
