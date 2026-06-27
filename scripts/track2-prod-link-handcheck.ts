/**
 * Track 2 prod execution: invite→accept + isolation hand-check (read-only).
 * Manual / one-off — not CI. Requires prod seeds + .env.projects.local.
 *
 *   npm run track2:prod-link-handcheck
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PROD_CANARY, PROD_ROLE_CANARIES } from './e2e-test-identities'
import {
  createE2eAuthSessionForEmail,
  findUserIdByEmail,
  initSupabaseEnv,
} from './seed-e2e-lib'
import { authCookieHeader } from '@/lib/verify/authSession'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim() || 'https://www.mywealthmaps.com'
/** Real prod consumer — canary advisor must NOT be linked to this owner. */
const FOREIGN_CLIENT_EMAIL =
  process.env.TRACK2_FOREIGN_CLIENT_EMAIL?.trim() || 'david@gmail.com'

function loadProdSupabaseEnv(): void {
  const projectsFile = join(process.cwd(), '.env.projects.local')
  if (!existsSync(projectsFile)) {
    console.error('Missing .env.projects.local')
    process.exit(1)
  }
  const contents = readFileSync(projectsFile, 'utf8')
  const get = (n: string) => contents.match(new RegExp(`^${n}=(.*)$`, 'm'))?.[1]?.trim().replace(/\r$/, '') ?? ''
  for (const [target, source] of [
    ['NEXT_PUBLIC_SUPABASE_URL', 'PROD_NEXT_PUBLIC_SUPABASE_URL'],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'PROD_SUPABASE_SERVICE_ROLE_KEY'],
  ] as const) {
    const val = get(source)
    if (!val) {
      console.error(`Missing ${source}`)
      process.exit(1)
    }
    process.env[target] = val
  }
  const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.match(/^([a-z0-9]+)/)?.[1]
  if (ref !== PRODUCTION_SUPABASE_PROJECT_REF) {
    console.error(`Ref must be ${PRODUCTION_SUPABASE_PROJECT_REF}, got ${ref}`)
    process.exit(1)
  }
}

async function apiFetch(
  path: string,
  cookie: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(60_000),
  })
}

async function main() {
  loadProdSupabaseEnv()
  initSupabaseEnv()
  const admin = createAdminClient()

  const consumerEmail = PROD_CANARY.email
  const advisorEmail = PROD_ROLE_CANARIES.advisor.email

  const consumerUserId = await findUserIdByEmail(consumerEmail)
  const advisorUserId = await findUserIdByEmail(advisorEmail)
  const foreignClientId = await findUserIdByEmail(FOREIGN_CLIENT_EMAIL)

  if (!consumerUserId || !advisorUserId) {
    console.error('Missing canary profiles — run role + firm seeds first')
    process.exit(1)
  }
  if (!foreignClientId) {
    console.error(`Foreign client not found: ${FOREIGN_CLIENT_EMAIL}`)
    process.exit(1)
  }

  const { data: firm } = await admin
    .from('firms')
    .select('id, subscription_status')
    .eq('owner_id', advisorUserId)
    .maybeSingle()
  console.log(JSON.stringify({ step: 'firm-check', firm }))

  const { data: existingLink } = await admin
    .from('advisor_clients')
    .select('id, status, accepted_at')
    .eq('advisor_id', advisorUserId)
    .eq('client_id', consumerUserId)
    .maybeSingle()

  const consumerSession = await createE2eAuthSessionForEmail(consumerEmail)
  const advisorSession = await createE2eAuthSessionForEmail(advisorEmail)
  const consumerCookie = authCookieHeader(consumerSession.supabaseUrl, consumerSession.session)
  const advisorCookie = authCookieHeader(advisorSession.supabaseUrl, advisorSession.session)

  let linkRow = existingLink

  if (existingLink && [...CONNECTED_ADVISOR_CLIENT_STATUSES].includes(existingLink.status)) {
    console.log(JSON.stringify({ step: 'link', action: 'skip', status: existingLink.status }))
  } else if (existingLink?.status === 'consumer_requested') {
    console.log(JSON.stringify({ step: 'link', action: 'accept-existing-pending', id: existingLink.id }))
    const acceptRes = await apiFetch('/api/advisor/accept-request', advisorCookie, {
      method: 'POST',
      body: JSON.stringify({ advisor_client_id: existingLink.id }),
    })
    const acceptBody = await acceptRes.text()
    console.log(JSON.stringify({ step: 'accept', status: acceptRes.status, body: acceptBody.slice(0, 200) }))
    if (!acceptRes.ok) process.exit(1)
    linkRow = { ...existingLink, status: 'active' }
  } else {
    console.log(JSON.stringify({ step: 'link', action: 'invite' }))
    const inviteRes = await apiFetch('/api/consumer/invite-advisor', consumerCookie, {
      method: 'POST',
      body: JSON.stringify({ advisorEmail }),
    })
    const inviteBody = await inviteRes.text()
    console.log(JSON.stringify({ step: 'invite', status: inviteRes.status, body: inviteBody.slice(0, 200) }))
    if (inviteRes.status === 409) {
      console.error('409 on invite — accept existing pending row instead of re-inviting')
      process.exit(1)
    }
    if (!inviteRes.ok) process.exit(1)

    const { data: pending } = await admin
      .from('advisor_clients')
      .select('id, status')
      .eq('advisor_id', advisorUserId)
      .eq('client_id', consumerUserId)
      .eq('status', 'consumer_requested')
      .maybeSingle()
    if (!pending?.id) {
      console.error('No consumer_requested row after invite')
      process.exit(1)
    }

    const acceptRes = await apiFetch('/api/advisor/accept-request', advisorCookie, {
      method: 'POST',
      body: JSON.stringify({ advisor_client_id: pending.id }),
    })
    const acceptBody = await acceptRes.text()
    console.log(JSON.stringify({ step: 'accept', status: acceptRes.status, body: acceptBody.slice(0, 200) }))
    if (!acceptRes.ok) process.exit(1)
    linkRow = pending
  }

  const { data: finalLink } = await admin
    .from('advisor_clients')
    .select('status, accepted_at')
    .eq('advisor_id', advisorUserId)
    .eq('client_id', consumerUserId)
    .single()
  console.log(JSON.stringify({ step: 'link-final', finalLink }))

  const positiveRes = await apiFetch(
    `/api/advisor/client-export-payload?clientId=${consumerUserId}`,
    advisorCookie,
  )
  console.log(
    JSON.stringify({
      step: 'handcheck-positive',
      clientId: consumerUserId,
      label: 'linked canary consumer',
      status: positiveRes.status,
      verdict: positiveRes.status < 400 ? 'PASS' : 'STOP',
    }),
  )

  const negativeRes = await apiFetch(
    `/api/advisor/client-export-payload?clientId=${foreignClientId}`,
    advisorCookie,
  )
  const denied = [403, 404].includes(negativeRes.status)
  console.log(
    JSON.stringify({
      step: 'handcheck-negative',
      clientId: foreignClientId,
      foreignEmail: FOREIGN_CLIENT_EMAIL,
      status: negativeRes.status,
      verdict: denied ? 'PASS (clean deny)' : 'STOP (not 403/404 — includes 500)',
    }),
  )

  if (positiveRes.status >= 400 || !denied) {
    process.exit(1)
  }
  console.log('\nTrack 2 hand-check PASSED — prod smoke keeps proving it via @production isolation blocks')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
