/**
 * Force Voels base-case regenerate and verify engine B death-year state tax in stored rows.
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/regenerate-base-case-voels.ts
 *
 * Optional: PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com (default)
 */

import { createClient } from '@supabase/supabase-js'

const VOELS_HOUSEHOLD_ID = '5ea14f56-e880-4992-87bc-0d815a450cdc'
const EXPECTED_DEATH_YEAR = 2057
const EXPECTED_STATE_TAX = 18_273_170

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.mywealthmaps.com'

type OutputRow = {
  year: number
  estate_tax_state?: number
  estate_tax_federal?: number
}

function projectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split('.')[0] ?? 'local'
}

function authCookieHeader(session: {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  token_type: string
  user: unknown
}) {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64')
  return `sb-${projectRef(url!)}-auth-token=base64-${payload}`
}

async function createAdvisorSession(admin: ReturnType<typeof createClient>) {
  const email = process.env.SMOKE_ADVISOR_EMAIL ?? 'avoels@comcast.net'
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linkErr || !linkData?.properties?.hashed_token) {
    throw new Error(`generateLink failed: ${linkErr?.message ?? 'no token'}`)
  }
  if (!anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const anon = createClient(url!, anonKey, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (error || !data.session) throw new Error(`verifyOtp failed: ${error?.message ?? 'no session'}`)
  return data.session
}

async function readScenarioSnapshot(
  admin: ReturnType<typeof createClient>,
  scenarioId: string,
) {
  const { data, error } = await admin
    .from('projection_scenarios')
    .select('id, calculated_at, outputs_s1_first')
    .eq('id', scenarioId)
    .single()
  if (error || !data) throw new Error(error?.message ?? 'scenario not found')
  const rows = (data.outputs_s1_first ?? []) as OutputRow[]
  const deathRow = rows.find((r) => r.year === EXPECTED_DEATH_YEAR)
  return {
    calculatedAt: data.calculated_at as string | null,
    deathStateTax: deathRow?.estate_tax_state ?? null,
    deathFederalTax: deathRow?.estate_tax_federal ?? null,
  }
}

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: household, error: hhErr } = await admin
    .from('households')
    .select('id, base_case_scenario_id, updated_at')
    .eq('id', VOELS_HOUSEHOLD_ID)
    .single()

  if (hhErr || !household?.base_case_scenario_id) {
    console.error('Voels household not found', hhErr?.message)
    process.exit(1)
  }

  const scenarioId = household.base_case_scenario_id
  const before = await readScenarioSnapshot(admin, scenarioId)

  console.log('=== Before regenerate ===')
  console.log('scenario_id:', scenarioId)
  console.log('calculated_at:', before.calculatedAt)
  console.log(`death year ${EXPECTED_DEATH_YEAR} state tax:`, before.deathStateTax)

  if (!anonKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY — cannot call generate-base-case API')
    process.exit(1)
  }

  const session = await createAdvisorSession(admin)
  const cookie = authCookieHeader(session)

  console.log('\nPOST /api/advisor/generate-base-case …')
  const t0 = Date.now()
  const res = await fetch(`${BASE_URL}/api/advisor/generate-base-case`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify({ householdId: VOELS_HOUSEHOLD_ID }),
  })
  const body = await res.json().catch(() => ({}))
  console.log(`HTTP ${res.status} in ${Date.now() - t0}ms`, body)

  if (!res.ok) {
    console.error('Regenerate failed')
    process.exit(1)
  }

  const newScenarioId = (body as { scenarioId?: string }).scenarioId ?? scenarioId
  const after = await readScenarioSnapshot(admin, newScenarioId)

  console.log('\n=== After regenerate ===')
  console.log('scenario_id:', newScenarioId)
  console.log('calculated_at:', after.calculatedAt)
  console.log(`death year ${EXPECTED_DEATH_YEAR} state tax:`, after.deathStateTax)
  console.log(`death year ${EXPECTED_DEATH_YEAR} federal tax:`, after.deathFederalTax)

  const calculatedFresh =
    Boolean(after.calculatedAt) &&
    Boolean(before.calculatedAt) &&
    new Date(after.calculatedAt!).getTime() >= new Date(before.calculatedAt!).getTime()

  const stateTaxOk = after.deathStateTax === EXPECTED_STATE_TAX
  const nonZeroOk = Number(after.deathStateTax ?? 0) > 0

  console.log('\n=== Checks ===')
  console.log(calculatedFresh ? 'PASS' : 'FAIL', '— calculated_at refreshed')
  console.log(stateTaxOk ? 'PASS' : 'FAIL', `— death-year state tax = $${EXPECTED_STATE_TAX.toLocaleString()}`)
  console.log(nonZeroOk ? 'PASS' : 'FAIL', '— death-year state tax non-zero')

  if (!calculatedFresh || !stateTaxOk || !nonZeroOk) {
    process.exit(1)
  }

  console.log('\nREGENERATE SMOKE PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
