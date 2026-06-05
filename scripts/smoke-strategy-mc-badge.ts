/**
 * Browser smoke: Strategy tab MC badge + Last precomputed
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx dotenv-cli -e .env.local -e .env.test -- npx tsx scripts/smoke-strategy-mc-badge.ts
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const rawSmokeEmail = process.env.SMOKE_ADVISOR_EMAIL
const rawSmokePassword = process.env.SMOKE_ADVISOR_PASSWORD
const smokePasswordLooksPlaceholder =
  !rawSmokePassword ||
  rawSmokePassword.includes('<your') ||
  rawSmokePassword.includes('placeholder')

const ADVISOR_EMAIL =
  (!smokePasswordLooksPlaceholder && rawSmokeEmail) ||
  process.env.PLAYWRIGHT_ADVISOR_EMAIL ||
  'e2e-advisor@mywealthmaps.test'
const ADVISOR_PASSWORD =
  (!smokePasswordLooksPlaceholder && rawSmokePassword) ||
  process.env.PLAYWRIGHT_ADVISOR_PASSWORD ||
  'E2eTest!2026Mwm'

// Alan Voels (avoels@outlook.com) — owner_id for advisor client route
const VOELS_CLIENT_ID = 'dbff0d6c-4b8c-46f5-b8fc-5925b8e6bd93'
const E2E_CONSUMER_HOUSEHOLD = '232f922c-9b66-40b4-acfb-c5734f0db4b2'

async function ensureE2eConsumerNoMc(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: hh } = await admin
    .from('households')
    .select('owner_id, base_case_scenario_id')
    .eq('id', E2E_CONSUMER_HOUSEHOLD)
    .maybeSingle()
  if (!hh?.owner_id || !hh.base_case_scenario_id) return null
  await admin.from('monte_carlo_results').delete().eq('scenario_id', hh.base_case_scenario_id)
  return hh.owner_id
}

async function loginAdvisor(page: import('playwright').Page) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(ADVISOR_EMAIL)
  await page.locator('input[id="password"]').fill(ADVISOR_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 })
}

async function checkStrategyTab(
  page: import('playwright').Page,
  clientId: string,
  expectBadge: boolean,
  expectTimestamp: boolean,
  label: string,
): Promise<boolean> {
  await page.goto(`${BASE_URL}/advisor/clients/${clientId}?tab=strategy`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(4000)

  const body = await page.locator('body').innerText()
  const hasP10P90 = /P10 \$[\d,]+ – P90 \$[\d,]+/.test(body)
  const hasLastPrecomputed = /Last precomputed:/i.test(body)
  const atDeathRow = body.includes('At Death')

  if (!atDeathRow) {
    console.error(`FAIL [${label}]: Strategy horizon table / At Death row not found`)
    return false
  }

  if (expectBadge && !hasP10P90) {
    console.error(`FAIL [${label}]: expected P10/P90 badge, not found`)
    ok = false
  }
  if (!expectBadge && hasP10P90) {
    console.error(`FAIL [${label}]: P10/P90 badge should be absent`)
    ok = false
  }
  if (expectTimestamp && !hasLastPrecomputed) {
    console.error(`FAIL [${label}]: expected Last precomputed timestamp`)
    ok = false
  }
  if (!expectTimestamp && hasLastPrecomputed) {
    console.error(`FAIL [${label}]: Last precomputed should be absent`)
    ok = false
  }

  if (ok) {
    console.log(
      `PASS [${label}]: badge=${hasP10P90 ? 'yes' : 'no'} timestamp=${hasLastPrecomputed ? 'yes' : 'no'}`,
    )
  }
  return ok
}

async function main() {
  if (!url || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: voelsMc } = await admin
    .from('monte_carlo_results')
    .select('p10_estate, p90_estate, mc_calculated_at')
    .eq('scenario_id', '1da0c50f-de5f-4975-ae9a-f57242984962')
    .maybeSingle()

  if (!voelsMc?.mc_calculated_at) {
    console.error('FAIL [setup]: Voels MC row missing — run MC precompute first')
    process.exit(1)
  }
  console.log('Voels MC DB ok:', voelsMc.mc_calculated_at)

  const noMcClientId = await ensureE2eConsumerNoMc(admin)
  if (!noMcClientId) {
    console.warn('WARN: e2e consumer household not found — skipping null case')
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  let ok = true

  try {
    await loginAdvisor(page)
    ok = (await checkStrategyTab(page, VOELS_CLIENT_ID, true, true, 'Voels advisor')) && ok
    if (noMcClientId) {
      ok =
        (await checkStrategyTab(page, noMcClientId, false, false, 'client without MC')) && ok
    }
  } finally {
    await browser.close()
  }

  if (!ok) process.exit(1)
  console.log('\nSTRATEGY TAB SMOKE PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
