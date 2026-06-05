/**
 * Browser smoke: PDF page 2 MC band polygons (?type=report)
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx dotenv-cli -e .env.local -e .env.test -- npx tsx scripts/smoke-pdf-mc-bands.ts
 */

import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const rawSmokePassword = process.env.SMOKE_ADVISOR_PASSWORD
const smokePasswordLooksPlaceholder =
  !rawSmokePassword ||
  rawSmokePassword.includes('<your') ||
  rawSmokePassword.includes('placeholder')

const ADVISOR_EMAIL =
  (!smokePasswordLooksPlaceholder && process.env.SMOKE_ADVISOR_EMAIL) ||
  process.env.PLAYWRIGHT_ADVISOR_EMAIL ||
  'e2e-advisor@mywealthmaps.test'
const ADVISOR_PASSWORD =
  (!smokePasswordLooksPlaceholder && rawSmokePassword) ||
  process.env.PLAYWRIGHT_ADVISOR_PASSWORD ||
  'E2eTest!2026Mwm'

const VOELS_CLIENT_ID = 'dbff0d6c-4b8c-46f5-b8fc-5925b8e6bd93'
const E2E_CONSUMER_HOUSEHOLD = '232f922c-9b66-40b4-acfb-c5734f0db4b2'

const GROSS_BAND = 'fill="#3b82f6"'
const NET_BAND = 'fill="#10b981"'
const GROSS_LINE = 'stroke="#378ADD"'

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

function extractPage2Svg(html: string): string {
  const marker = 'Estate growth projection'
  const idx = html.indexOf(marker)
  if (idx < 0) return ''
  const svgStart = html.indexOf('<svg viewBox="0 0 600 180"', idx)
  if (svgStart < 0) return ''
  const svgEnd = html.indexOf('</svg>', svgStart)
  if (svgEnd < 0) return ''
  return html.slice(svgStart, svgEnd + 6)
}

function analyzeSvg(svg: string) {
  return {
    hasGrossBand: svg.includes(GROSS_BAND),
    hasNetBand: svg.includes(NET_BAND),
    bandBeforeLine:
      svg.includes(GROSS_BAND) &&
      svg.indexOf(GROSS_BAND) < svg.indexOf(GROSS_LINE),
    isInlineSvg: svg.startsWith('<svg') && !svg.includes('<script'),
  }
}

async function fetchReportHtml(
  page: import('playwright').Page,
  clientId: string,
): Promise<string> {
  const res = await page.goto(
    `${BASE_URL}/api/advisor/meeting-prep-pdf/${clientId}?type=report&_=${Date.now()}`,
    { waitUntil: 'domcontentloaded' },
  )
  if (!res?.ok()) {
    throw new Error(`HTTP ${res?.status()} for client ${clientId}`)
  }
  return page.content()
}

async function checkReport(
  page: import('playwright').Page,
  clientId: string,
  expectBands: boolean,
  label: string,
): Promise<boolean> {
  const html = await fetchReportHtml(page, clientId)
  const svg = extractPage2Svg(html)
  if (!svg) {
    console.error(`FAIL [${label}]: page 2 estate growth SVG not found`)
    return false
  }

  const screen = analyzeSvg(svg)

  await page.emulateMedia({ media: 'print' })
  const printHtml = await fetchReportHtml(page, clientId)
  await page.emulateMedia({ media: 'screen' })
  const printSvg = extractPage2Svg(printHtml)
  const print = analyzeSvg(printSvg)

  let ok = true
  if (expectBands) {
    if (!screen.hasGrossBand || !screen.hasNetBand) {
      console.error(`FAIL [${label}]: expected gross + net band fills in screen HTML`)
      ok = false
    }
    if (!screen.bandBeforeLine) {
      console.error(`FAIL [${label}]: bands should render before deterministic gross line`)
      ok = false
    }
    if (!print.hasGrossBand || !print.hasNetBand) {
      console.error(`FAIL [${label}]: expected bands in print-media HTML (Cmd+P safe)`)
      ok = false
    }
  } else {
    if (screen.hasGrossBand || screen.hasNetBand) {
      console.error(`FAIL [${label}]: MC band fills should be absent`)
      ok = false
    }
  }

  if (!screen.isInlineSvg) {
    console.error(`FAIL [${label}]: chart should be inline SVG without script`)
    ok = false
  }

  if (ok) {
    console.log(
      `PASS [${label}]: bands=${screen.hasGrossBand ? 'gross+net' : 'none'} print=${print.hasGrossBand ? 'yes' : 'no'} inlineSvg=yes`,
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
    .select('scenario_id')
    .eq('scenario_id', '1da0c50f-de5f-4975-ae9a-f57242984962')
    .maybeSingle()

  if (!voelsMc) {
    console.error('FAIL [setup]: Voels MC row missing')
    process.exit(1)
  }

  const noMcClientId = await ensureE2eConsumerNoMc(admin)
  if (!noMcClientId) {
    console.warn('WARN: e2e consumer household not found — skipping null case')
  }

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  let ok = true

  try {
    await loginAdvisor(page)
    ok = (await checkReport(page, VOELS_CLIENT_ID, true, 'Voels ?type=report')) && ok
    if (noMcClientId) {
      ok = (await checkReport(page, noMcClientId, false, 'client without MC')) && ok
    }
  } finally {
    await browser.close()
  }

  if (!ok) process.exit(1)
  console.log('\nPDF PAGE 2 MC BANDS SMOKE PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
