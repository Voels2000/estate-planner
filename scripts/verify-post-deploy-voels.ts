/**
 * Post-deploy verification — Voels MC Phase 3 + cleanup pass (2026-06-05)
 * Run: npx dotenv-cli -e .env.local -- npx tsx scripts/verify-post-deploy-voels.ts
 *
 * Optional UI: PLAYWRIGHT_BASE_URL=https://www.mywealthmaps.com (or localhost:3000)
 */

import { createClient } from '@supabase/supabase-js'
import { loadScenarioMonteCarlo } from '@/lib/advisor/loadScenarioMonteCarlo'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

const VOELS_HOUSEHOLD_ID = '5ea14f56-e880-4992-87bc-0d815a450cdc'
const VOELS_SCENARIO_ID = '1da0c50f-de5f-4975-ae9a-f57242984962'
const VOELS_ADVISOR_ID = '854051be-3aac-4d43-8062-df414a7055e1'
const VOELS_CONSUMER_ID = 'dbff0d6c-4b8c-46f5-b8fc-5925b8e6bd93'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.mywealthmaps.com'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

type Check = { id: string; pass: boolean; detail: string }
const checks: Check[] = []

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${id}: ${detail}`)
}

async function fetchStateExemption(
  admin: ReturnType<typeof createClient>,
  statePrimary: string,
): Promise<number | null> {
  const state = statePrimary.trim().toUpperCase()
  if (!state) return null
  const currentYear = new Date().getFullYear()
  let rulesRes = await admin
    .from('state_estate_tax_rules')
    .select('exemption_amount')
    .eq('state', state)
    .eq('tax_year', currentYear)
    .order('min_amount', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!rulesRes.data?.exemption_amount) {
    rulesRes = await admin
      .from('state_estate_tax_rules')
      .select('exemption_amount')
      .eq('state', state)
      .order('tax_year', { ascending: false })
      .order('min_amount', { ascending: true })
      .limit(1)
      .maybeSingle()
  }
  return rulesRes.data?.exemption_amount != null ? Number(rulesRes.data.exemption_amount) : null
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
  const anon = createClient(url!, anonKey!, { auth: { persistSession: false } })
  const { data, error } = await anon.auth.verifyOtp({
    type: 'magiclink',
    token_hash: linkData.properties.hashed_token,
  })
  if (error || !data.session) throw new Error(`verifyOtp failed: ${error?.message ?? 'no session'}`)
  return data.session
}

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: household } = await admin
    .from('households')
    .select('id, owner_id, state_primary, base_case_scenario_id, person1_name')
    .eq('id', VOELS_HOUSEHOLD_ID)
    .single()

  if (!household) {
    record('setup', false, 'Voels household not found')
    process.exit(1)
  }

  const scenarioId = household.base_case_scenario_id ?? VOELS_SCENARIO_ID
  const mc = await loadScenarioMonteCarlo(scenarioId, admin)

  // 1 — MC threshold line data (/projections)
  const stateExemption = await fetchStateExemption(admin, household.state_primary ?? 'WA')
  const bands = mc?.percentiles_by_year ?? []
  const maxP90 = bands.length ? Math.max(...bands.map((b) => b.p90_gross)) : 0
  const thresholdOk =
    stateExemption != null &&
    stateExemption > 0 &&
    maxP90 > stateExemption &&
    bands.length >= 5

  record(
    'projections-threshold-line',
    Boolean(thresholdOk),
    `stateExemption=$${stateExemption?.toLocaleString() ?? 'null'} maxP90=$${Math.round(maxP90).toLocaleString()} bandYears=${bands.length} (line should sit low on chart)`,
  )

  // 2 — MC copy (/estate-tax)
  const wa0 = mc?.wa_threshold_prob_by_year?.[0] ?? null
  const copyOk =
    wa0 != null &&
    wa0.pct_above_threshold === 100 &&
    wa0.year >= new Date().getFullYear() - 1

  record(
    'estate-tax-mc-copy',
    Boolean(copyOk),
    wa0
      ? `year=${wa0.year} pct_above_threshold=${wa0.pct_above_threshold} → "all simulated market scenarios"`
      : 'wa_threshold_prob_by_year[0] missing',
  )

  // 3 — Depletion tile (Strategy tab)
  const depletionOk =
    mc?.longevity_depletion_pct != null &&
    mc.longevity_depletion_pct === 0 &&
    (mc.depletion_floor_amount ?? 0) >= 500_000

  record(
    'strategy-depletion-tile',
    Boolean(depletionOk),
    `longevity_depletion_pct=${mc?.longevity_depletion_pct ?? 'null'} floor=${mc?.depletion_floor_amount ?? 'null'} (expect green 0%)`,
  )

  // 4 — PDF narrative (first_tax_year_p10)
  const firstTaxYear = mc?.first_tax_year_p10 ?? null
  record(
    'pdf-first-tax-year-signal',
    firstTaxYear != null && firstTaxYear >= 2020,
    `first_tax_year_p10=${firstTaxYear ?? 'null'} (stored MC signal)`,
  )

  if (anonKey) {
    try {
      const session = await createAdvisorSession(admin)
      const cookie = authCookieHeader(session)
      const res = await fetch(
        `${BASE_URL}/api/advisor/meeting-prep-pdf/${VOELS_CONSUMER_ID}?type=report&_=${Date.now()}`,
        { headers: { Cookie: cookie } },
      )
      const html = await res.text()
      const hasMcLine = /may begin as early as age \d+/i.test(html)
      const hasAgeFromYear =
        firstTaxYear != null && html.includes(String(firstTaxYear)) ? true : hasMcLine

      record(
        'pdf-narrative-mc-line',
        res.ok && hasMcLine,
        res.ok
          ? hasMcLine
            ? `HTTP ${res.status}; MC age line present in PDF HTML`
            : `HTTP ${res.status}; MC age line NOT found in HTML`
          : `HTTP ${res.status} ${html.slice(0, 120)}`,
      )
    } catch (e) {
      record(
        'pdf-narrative-mc-line',
        false,
        `PDF fetch failed: ${e instanceof Error ? e.message : String(e)}`,
      )
    }
  } else {
    record('pdf-narrative-mc-line', false, 'Skipped — no NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  // 5 — /my-advisor multi-row fix
  const { data: allConnections } = await admin
    .from('advisor_clients')
    .select('id, status, accepted_at, advisor_id')
    .eq('client_id', VOELS_CONSUMER_ID)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])

  const { data: pickedConnection } = await admin
    .from('advisor_clients')
    .select(`
      id,
      advisor_id,
      accepted_at,
      profiles!advisor_clients_advisor_id_fkey ( full_name, email )
    `)
    .eq('client_id', VOELS_CONSUMER_ID)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .order('accepted_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const profile = pickedConnection?.profiles as { full_name?: string; email?: string } | null
  const advisorName = profile?.full_name ?? profile?.email ?? ''
  const multiRowCount = allConnections?.length ?? 0
  const advisorOk =
    pickedConnection != null &&
    pickedConnection.advisor_id === VOELS_ADVISOR_ID &&
    /voels/i.test(advisorName)

  record(
    'my-advisor-connection',
    Boolean(advisorOk),
    `active/accepted rows=${multiRowCount} picked advisor=${advisorName || pickedConnection?.advisor_id} (query uses order+limit, no PGRST116)`,
  )

  // 6 — Dashboard household (cached path data parity)
  const { data: fullHousehold } = await admin
    .from('households')
    .select('*')
    .eq('owner_id', household.owner_id)
    .maybeSingle()

  const { data: layoutSlice } = await admin
    .from('households')
    .select('id, state_primary, filing_status, person1_birth_year')
    .eq('owner_id', household.owner_id)
    .maybeSingle()

  const dashOk =
    fullHousehold?.id === VOELS_HOUSEHOLD_ID &&
    layoutSlice?.id === fullHousehold.id &&
    fullHousehold.state_primary === layoutSlice.state_primary &&
    fullHousehold.person1_name != null

  record(
    'dashboard-household-fetch',
    Boolean(dashOk),
    `full row id=${fullHousehold?.id} person1=${fullHousehold?.person1_name} state=${fullHousehold?.state_primary} (layout slice matches)`,
  )

  console.log('\n=== Summary ===')
  const failed = checks.filter((c) => !c.pass)
  for (const c of checks) {
    console.log(`  ${c.pass ? '✓' : '✗'} ${c.id}`)
  }
  if (failed.length) {
    console.error(`\n${failed.length}/${checks.length} checks FAILED`)
    process.exit(1)
  }
  console.log(`\nAll ${checks.length} checks PASSED (data/API layer)`)
  console.log(
    '\nManual browser still recommended: /projections amber line, /estate-tax copy, Strategy Depletion tile UI.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
