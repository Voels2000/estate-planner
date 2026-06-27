/**
 * Pending-link authz (consumer_requested) — proves the invite window grants no access,
 * and proves it for the right reason via a pending→active transition on one pair.
 *
 * Uses e2e-consumer-pending + e2e-advisor-pending (not shared link-fixture identities)
 * so auth transitions in this spec never mutate .auth/advisor.<suite>.json sessions.
 *
 * Phase 1 denies on profiles RLS, estate-composition, and client-export-payload while
 * consumer_requested. Phase 2 accepts through accept-request and asserts the same routes
 * succeed. Only link status changes — the active phase is the teeth-check.
 */
import { test, expect, request as playwrightRequest } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import {
  buildSupabaseAuthCookieHeader,
  createE2eAuthSessionForEmail,
  ensureE2eAdvisorFirmSubscriptionActive,
  initSupabaseEnv,
} from '../../../scripts/seed-e2e-lib'
import type { APIRequestContext } from '@playwright/test'
import { resolvePendingLinkFixtureEnv } from '../helpers/e2e-advisor-link-env'
import { resolveE2ePassword } from '../helpers/e2e-auth'
import { getWithAuthRetry } from '../helpers/request-auth-retry'

test.describe.configure({ mode: 'serial' })

const API_TIMEOUT_MS = 30_000
const CONSUMER_PENDING_AUTH = '.auth/consumer-pending.json'
const ADVISOR_PENDING_AUTH = '.auth/advisor-pending.json'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

let advisorUserId = ''
let consumerUserId = ''
let consumerHouseholdId = ''
let advisorEmail = ''
let advisorPassword = ''

async function resetLink() {
  const admin = createAdminClient()
  await admin
    .from('advisor_clients')
    .delete()
    .eq('advisor_id', advisorUserId)
    .eq('client_id', consumerUserId)
}

async function getLink() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('advisor_clients')
    .select('id, status, accepted_at')
    .eq('advisor_id', advisorUserId)
    .eq('client_id', consumerUserId)
    .maybeSingle()
  return data
}

async function ensureCleanPendingPair() {
  await resetLink()
  expect(await getLink(), 'pair must start with no advisor_clients row').toBeFalsy()
}

async function advisorReadsProfile() {
  const db = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await db.auth.signInWithPassword({
    email: advisorEmail,
    password: advisorPassword,
  })
  expect(signInError, signInError?.message).toBeNull()

  const { data } = await db
    .from('profiles')
    .select('full_name, email')
    .eq('id', consumerUserId)
    .maybeSingle()

  await db.auth.signOut()
  return data
}

function expectAccessDenied(status: number) {
  expect([403, 404], `expected access denied, got ${status}`).toContain(status)
}

/** signInWithPassword (profile RLS read) revokes stored cookie sessions — mint fresh for Phase 2. */
async function freshAdvisorApiContext(): Promise<APIRequestContext> {
  const { session, supabaseUrl: url } = await createE2eAuthSessionForEmail(advisorEmail)
  expect(session.user.id, 'fresh advisor session must match fixture advisor user id').toBe(
    advisorUserId,
  )
  return playwrightRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    extraHTTPHeaders: {
      Cookie: buildSupabaseAuthCookieHeader(url, session),
    },
  })
}

test.beforeAll(async ({}, testInfo) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    testInfo.skip(true, 'NEXT_PUBLIC_SUPABASE_* required')
    return
  }

  initSupabaseEnv()
  const env = await resolvePendingLinkFixtureEnv()

  if (!env.advisorUserId || !env.pendingConsumerUserId || !env.pendingConsumerHouseholdId) {
    testInfo.skip(
      true,
      'e2e-consumer-pending + e2e-advisor-pending missing — run npm run seed:e2e with advisor-pending',
    )
    return
  }

  advisorUserId = env.advisorUserId
  consumerUserId = env.pendingConsumerUserId
  consumerHouseholdId = env.pendingConsumerHouseholdId
  advisorEmail = env.advisorEmail
  advisorPassword = resolveE2ePassword(
    advisorEmail,
    process.env.PLAYWRIGHT_ADVISOR_PENDING_PASSWORD ?? process.env.PLAYWRIGHT_ADVISOR_PASSWORD,
  )

  await ensureE2eAdvisorFirmSubscriptionActive(advisorUserId)
})

test.afterAll(async () => {
  if (!advisorUserId || !consumerUserId) return
  await resetLink()
})

test.describe('advisor pending link (consumer_requested) authz', () => {
  test('pending grants no access; accepting grants access (status is the only variable)', async () => {
    test.skip(!advisorUserId || !consumerUserId || !consumerHouseholdId, 'fixture env missing')

    await ensureCleanPendingPair()

    const consumer = await playwrightRequest.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
      storageState: CONSUMER_PENDING_AUTH,
    })

    const phase1Advisor = await playwrightRequest.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
      storageState: ADVISOR_PENDING_AUTH,
    })

    try {
      const invite = await consumer.post('/api/consumer/invite-advisor', {
        data: { advisorEmail },
        timeout: API_TIMEOUT_MS,
      })
      expect(invite.ok(), await invite.text()).toBeTruthy()

      await expect
        .poll(
          async () => (await getLink())?.status ?? null,
          { message: 'invite should create consumer_requested', timeout: 15_000 },
        )
        .toBe('consumer_requested')

      const pending = await getLink()
      expect(pending?.id, 'pending row must exist after invite').toBeTruthy()
      expect(pending?.status, 'invite should create consumer_requested').toBe('consumer_requested')
      expect(pending?.accepted_at, 'pending must not be accepted').toBeFalsy()

      const pendingComposition = await phase1Advisor.post('/api/estate-composition', {
        data: { householdId: consumerHouseholdId, sourceRole: 'advisor' },
        timeout: API_TIMEOUT_MS,
      })
      const pendingCompositionBody = await pendingComposition.text()
      expectAccessDenied(pendingComposition.status())

      const pendingPayload = await getWithAuthRetry(
        phase1Advisor,
        `/api/advisor/client-export-payload?clientId=${consumerUserId}`,
        { timeout: API_TIMEOUT_MS },
        'pending-link-phase1-client-export',
      )
      const pendingPayloadBody = await pendingPayload.text()
      expectAccessDenied(pendingPayload.status())

      console.log(
        JSON.stringify({
          phase1: {
            compositionStatus: pendingComposition.status(),
            compositionBody: pendingCompositionBody.slice(0, 200),
            payloadStatus: pendingPayload.status(),
            payloadBody: pendingPayloadBody.slice(0, 200),
          },
        }),
      )

      expect(
        await advisorReadsProfile(),
        'profiles RLS must hide consumer from a pending advisor',
      ).toBeFalsy()

      const pendingBeforeAccept = await getLink()
      expect(pendingBeforeAccept?.status, 'row must still be consumer_requested before accept').toBe(
        'consumer_requested',
      )
      const pendingLinkId = pendingBeforeAccept!.id

      console.log(
        JSON.stringify({
          phase2AcceptPrep: {
            pendingLinkId,
            advisorUserId,
            advisorEmail,
          },
        }),
      )

      const advisorPhase2 = await freshAdvisorApiContext()
      try {
        const accept = await advisorPhase2.post('/api/advisor/accept-request', {
          data: { advisor_client_id: pendingLinkId },
          timeout: API_TIMEOUT_MS,
        })
        expect(accept.ok(), await accept.text()).toBeTruthy()

        const active = await getLink()
        expect(active?.status, 'accept-request must set a connected status').toBeTruthy()
        expect(
          (CONNECTED_ADVISOR_CLIENT_STATUSES as readonly string[]).includes(active!.status),
        ).toBeTruthy()
        expect(active?.accepted_at, 'accept-request must set accepted_at').toBeTruthy()

        const activeComposition = await advisorPhase2.post('/api/estate-composition', {
          data: { householdId: consumerHouseholdId, sourceRole: 'advisor' },
          timeout: API_TIMEOUT_MS,
        })
        const compositionBody = await activeComposition.text()
        expect(activeComposition.ok(), compositionBody).toBeTruthy()

        const activePayload = await getWithAuthRetry(
          advisorPhase2,
          `/api/advisor/client-export-payload?clientId=${consumerUserId}`,
          { timeout: API_TIMEOUT_MS },
          'pending-link-phase2-client-export',
        )
        const payloadJson = (await activePayload.json()) as Record<string, unknown>
        expect(
          activePayload.status(),
          'active advisor must reach the client payload',
        ).toBeLessThan(400)

        const activeProfile = await advisorReadsProfile()
        expect(activeProfile?.full_name, 'active advisor must read the client profile').toBeTruthy()

        console.log(
          JSON.stringify({
            phase2: {
              profile: activeProfile,
              compositionStatus: activeComposition.status(),
              compositionBodyLength: compositionBody.length,
              payloadStatus: activePayload.status(),
              payloadTopLevelKeys: Object.keys(payloadJson),
            },
          }),
        )
      } finally {
        await advisorPhase2.dispose()
      }
    } finally {
      await phase1Advisor.dispose()
      await consumer.dispose()
      await resetLink()
    }
  })
})
