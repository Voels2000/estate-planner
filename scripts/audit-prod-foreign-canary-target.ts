/**
 * Read-only prod fixture audit before prod smoke (link + foreign target).
 *   npm run audit:prod-foreign-canary-target
 *
 * Run this first when prod smoke fails or before trusting a prod run result.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { PROD_CANARY, PROD_ROLE_CANARIES } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

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

async function auditHousehold(userId: string) {
  const admin = createAdminClient()
  const { data: household } = await admin
    .from('households')
    .select('id, name, owner_id')
    .eq('owner_id', userId)
    .maybeSingle()
  if (!household?.id) return { household: null, assetCount: 0, incomeCount: 0 }

  const [{ count: assetCount }, { count: incomeCount }] = await Promise.all([
    admin.from('assets').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
    admin.from('income').select('*', { count: 'exact', head: true }).eq('owner_id', userId),
  ])
  return { household, assetCount: assetCount ?? 0, incomeCount: incomeCount ?? 0 }
}

async function main() {
  loadProdSupabaseEnv()
  initSupabaseEnv()
  const admin = createAdminClient()

  const advisorEmail = PROD_ROLE_CANARIES.advisor.email
  const foreignEmail = PROD_ROLE_CANARIES.advisorClient.email
  const linkedEmail = PROD_CANARY.email

  const advisorId = await findUserIdByEmail(advisorEmail)
  const foreignUserId = await findUserIdByEmail(foreignEmail)
  const linkedUserId = await findUserIdByEmail(linkedEmail)

  const foreignHousehold = foreignUserId ? await auditHousehold(foreignUserId) : null
  const linkedHousehold = linkedUserId ? await auditHousehold(linkedUserId) : null

  const { data: linkToForeign } =
    advisorId && foreignUserId
      ? await admin
          .from('advisor_clients')
          .select('id, status, accepted_at')
          .eq('advisor_id', advisorId)
          .eq('client_id', foreignUserId)
          .maybeSingle()
      : { data: null }

  const { data: linkToLinked } =
    advisorId && linkedUserId
      ? await admin
          .from('advisor_clients')
          .select('id, status, accepted_at')
          .eq('advisor_id', advisorId)
          .eq('client_id', linkedUserId)
          .maybeSingle()
      : { data: null }

  const foreignLinked =
    linkToForeign?.status != null &&
    (CONNECTED_ADVISOR_CLIENT_STATUSES as readonly string[]).includes(linkToForeign.status)

  const linkActive =
    linkToLinked?.status != null &&
    (CONNECTED_ADVISOR_CLIENT_STATUSES as readonly string[]).includes(linkToLinked.status)

  const { data: advisorProfile } = advisorId
    ? await admin.from('profiles').select('firm_id').eq('id', advisorId).maybeSingle()
    : { data: null }

  const { data: firm } = advisorProfile?.firm_id
    ? await admin
        .from('firms')
        .select('id, subscription_status')
        .eq('id', advisorProfile.firm_id)
        .maybeSingle()
    : { data: null }

  const populated =
    (foreignHousehold?.assetCount ?? 0) > 0 || (foreignHousehold?.incomeCount ?? 0) > 0

  let foreignVerdict: string
  if (!foreignUserId) foreignVerdict = 'FAIL — canary-advisor-client profile missing'
  else if (!foreignHousehold?.household) foreignVerdict = 'FAIL — no household'
  else if (foreignLinked) foreignVerdict = 'FAIL — linked to canary-advisor (not foreign)'
  else if (!populated) foreignVerdict = 'WARN — household empty (404 may be trivial, not authz)'
  else foreignVerdict = 'OK — populated, unlinked foreign household'

  let linkVerdict: string
  if (!advisorId || !linkedUserId) linkVerdict = 'FAIL — canary advisor or consumer profile missing'
  else if (!advisorProfile?.firm_id) linkVerdict = 'FAIL — advisor firm_id null (accept gate broken)'
  else if (!firm || !['active', 'trialing'].includes(firm.subscription_status ?? ''))
    linkVerdict = `FAIL — firm not active/trialing (${firm?.subscription_status ?? 'missing'})`
  else if (linkToLinked?.status === 'consumer_requested')
    linkVerdict = 'FAIL — pending consumer_requested row (accept needed, do not re-invite)'
  else if (!linkActive) linkVerdict = 'FAIL — no active link to canary-consumer'
  else linkVerdict = 'OK — active link, firm ready'

  console.log(
    JSON.stringify(
      {
        linkPrecondition: {
          advisorEmail,
          consumerEmail: linkedEmail,
          firmId: advisorProfile?.firm_id,
          firmSubscriptionStatus: firm?.subscription_status,
          linkStatus: linkToLinked?.status,
          linkAcceptedAt: linkToLinked?.accepted_at,
          pendingLinkId:
            linkToLinked?.status === 'consumer_requested' ? linkToLinked?.id : undefined,
          verdict: linkVerdict,
        },
        automatedForeignTarget: {
          email: foreignEmail,
          userId: foreignUserId,
          householdId: foreignHousehold?.household?.id,
          householdName: foreignHousehold?.household?.name,
          assetCount: foreignHousehold?.assetCount,
          incomeCount: foreignHousehold?.incomeCount,
          linkedToCanaryAdvisor: foreignLinked,
          linkRow: linkToForeign,
          verdict: foreignVerdict,
        },
        linkedClient: {
          email: linkedEmail,
          userId: linkedUserId,
          householdId: linkedHousehold?.household?.id,
        },
        prodSmokeReadingOrder: [
          '1. linkPrecondition.verdict OK',
          '2. advisor isolation blocks execute (not skip) in job log',
          '3. automatedForeignTarget.verdict OK — negative denies populated foreign household',
          '4. positive case reaches linked consumer (Advisor access @production green)',
        ],
        handCheckNote:
          'Hand-check (track2:prod-link-handcheck) used david@gmail.com. Automation uses canary-advisor-client@.',
      },
      null,
      2,
    ),
  )

  if (foreignVerdict.startsWith('FAIL') || linkVerdict.startsWith('FAIL')) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
