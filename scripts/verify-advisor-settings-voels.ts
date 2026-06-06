/**
 * Verification: advisor profile settings + PDF branding (avoels@comcast.net)
 * Run: PLAYWRIGHT_BASE_URL=http://localhost:3000 npx dotenv-cli -e .env.local -e .env.test -- npx tsx scripts/verify-advisor-settings-voels.ts
 */

import { createClient } from '@supabase/supabase-js'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADVISOR_EMAIL = process.env.SMOKE_ADVISOR_EMAIL ?? 'avoels@comcast.net'
const VOELS_ADVISOR_ID = '854051be-3aac-4d43-8062-df414a7055e1'
const VOELS_CLIENT_ID = 'dbff0d6c-4b8c-46f5-b8fc-5925b8e6bd93'
const ORIGINAL_FIRM = 'Voels Financial Group'
const TEMP_FIRM = 'Voels Financial Group LLC'

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}: ${detail}`)
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
  const name = `sb-${projectRef(url!)}-auth-token`
  return `${name}=base64-${payload}`
}

async function createAdvisorSession(admin: ReturnType<typeof createClient>) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: ADVISOR_EMAIL,
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

function extractCoverFirmName(html: string): string | null {
  const m = html.match(/<div class="firm-name">([^<]+)<\/div>/)
  return m?.[1]?.trim() ?? null
}

async function main() {
  if (!url || !anonKey || !serviceKey) {
    console.error('Missing Supabase env')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1) DB + page.tsx equivalent SELECT
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, firm_name, phone')
    .eq('id', VOELS_ADVISOR_ID)
    .single()

  record(
    'Form data source (profiles SELECT)',
    profile?.full_name === 'Alan Voels' &&
      profile?.firm_name === ORIGINAL_FIRM &&
      profile?.phone === '(218) 555-0147',
    `full_name="${profile?.full_name ?? ''}", firm_name="${profile?.firm_name ?? ''}", phone="${profile?.phone ?? ''}"`,
  )

  const session = await createAdvisorSession(admin)
  const cookie = authCookieHeader(session)

  // 2) GET /api/advisor/profile
  const getRes = await fetch(`${BASE_URL}/api/advisor/profile`, { headers: { Cookie: cookie } })
  const getJson = (await getRes.json().catch(() => ({}))) as {
    profile?: { full_name?: string | null; firm_name?: string | null; phone?: string | null }
    error?: string
  }
  record(
    'GET /api/advisor/profile',
    getRes.ok &&
      getJson.profile?.full_name === 'Alan Voels' &&
      getJson.profile?.firm_name === ORIGINAL_FIRM &&
      getJson.profile?.phone === '(218) 555-0147',
    getRes.ok
      ? `status=${getRes.status}, firm_name="${getJson.profile?.firm_name ?? ''}"`
      : `status=${getRes.status}, error=${getJson.error ?? getRes.statusText}`,
  )

  // 3) PATCH temp firm name
  const patchRes = await fetch(`${BASE_URL}/api/advisor/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ firm_name: TEMP_FIRM }),
  })
  const patchJson = (await patchRes.json().catch(() => ({}))) as {
    profile?: { firm_name?: string | null }
    error?: string
  }
  record(
    'PATCH firm_name → LLC + returns updated row',
    patchRes.ok && patchJson.profile?.firm_name === TEMP_FIRM,
    patchRes.ok
      ? `firm_name="${patchJson.profile?.firm_name ?? ''}"`
      : `status=${patchRes.status}, error=${patchJson.error ?? patchRes.statusText}`,
  )

  // 4) PDF cover after update
  const pdfRes = await fetch(
    `${BASE_URL}/api/advisor/meeting-prep-pdf/${VOELS_CLIENT_ID}?type=report&_=${Date.now()}`,
    { headers: { Cookie: cookie } },
  )
  const pdfHtml = pdfRes.ok ? await pdfRes.text() : ''
  const coverFirm = extractCoverFirmName(pdfHtml)
  record(
    'PDF ?type=report cover shows updated firm name',
    Boolean(pdfRes.ok && coverFirm?.includes(TEMP_FIRM)),
    pdfRes.ok ? `cover="${coverFirm ?? 'missing'}"` : `status=${pdfRes.status}`,
  )

  // 5) Revert
  const revertRes = await fetch(`${BASE_URL}/api/advisor/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ firm_name: ORIGINAL_FIRM }),
  })
  const revertJson = (await revertRes.json().catch(() => ({}))) as {
    profile?: { firm_name?: string | null }
  }
  record(
    'Revert firm_name to original',
    revertRes.ok && revertJson.profile?.firm_name === ORIGINAL_FIRM,
    `firm_name="${revertJson.profile?.firm_name ?? ''}"`,
  )

  // 6) Settings page SSR (MFA may redirect — note in detail)
  const settingsRes = await fetch(`${BASE_URL}/advisor/settings`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
  const settingsHtml = settingsRes.status === 200 ? await settingsRes.text() : ''
  const mfaRedirect = settingsRes.status >= 300 && settingsRes.status < 400
  const hasFullNameInput = settingsHtml.includes('id="advisor-full-name"')
  const hasAlan =
    settingsHtml.includes('value="Alan Voels"') ||
    settingsHtml.includes("Alan Voels") // controlled input may hydrate client-side
  record(
    '/advisor/settings page reachable with session',
    settingsRes.status === 200 && hasFullNameInput,
    mfaRedirect
      ? `MFA redirect (${settingsRes.status}) — complete MFA in browser for full UI check`
      : `status=${settingsRes.status}, form=${hasFullNameInput}, alanInHtml=${hasAlan}`,
  )

  // 7) Nav link in layout (static — advisor without firm_id)
  const { data: ownerProfile } = await admin
    .from('profiles')
    .select('firm_id, firm_role')
    .eq('id', VOELS_ADVISOR_ID)
    .single()
  record(
    'Nav context: Profile link for advisor without firm_id',
    ownerProfile?.firm_id == null && ownerProfile?.firm_role == null,
    `firm_id=${ownerProfile?.firm_id ?? 'null'}, firm_role=${ownerProfile?.firm_role ?? 'null'} (layout renders Profile ⚙️ for all advisors; Firm Settings only when firm_role=owner)`,
  )

  console.log('\n--- SUMMARY ---')
  for (const c of checks) console.log(`${c.pass ? '✓' : '✗'} ${c.name}`)
  if (checks.some((c) => !c.pass)) process.exit(1)
  console.log('\nADVISOR SETTINGS VERIFICATION PASSED')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
