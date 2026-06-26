/**
 * Pending-link authz (consumer_requested) — proves the invite window grants no access,
 * and proves it for the right reason via a pending→active transition on one pair.
 *
 * Phase 1 denies on profiles RLS, estate-composition, and client-export-payload while
 * consumer_requested. Phase 2 accepts through accept-request and asserts the same routes
 * succeed. Only link status changes — the active phase is the teeth-check.
 *
 * Wiring: security project depends on consumer-link-setup (not consumer-advisor-link-setup).
 * Advisor API calls use the Playwright `request` fixture + test.use storageState for Phase 1
 * app routes. signInWithPassword (profile RLS read) revokes that cookie session — accept +
 * Phase 2 app routes use a freshly minted session via createE2eAuthSessionForEmail.
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
import { resolveAdvisorLinkFixtureEnv } from '../helpers/e2e-advisor-link-env'
import { resolveE2ePassword } from '../helpers/e2e-auth'

test.describe.configure({ mode: 'serial' })

const API_TIMEOUT_MS = 30_000

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

/** signInWithPassword (profile RLS read) revokes the browser cookie session — mint a fresh one. */
async function freshAdvisorApiContext(): Promise<APIRequestContext> {
  const { session, supabaseUrl } = await createE2eAuthSessionForEmail(advisorEmail)
  return playwrightRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    extraHTTPHeaders: {
      Cookie: buildSupabaseAuthCookieHeader(supabaseUrl, session),
    },
  })
}

test.beforeAll(async ({}, testInfo) => {
  if (!supabaseUrl || !supabaseAnonKey) {
    testInfo.skip(true, 'NEXT_PUBLIC_SUPABASE_* required')
    return
  }

  initSupabaseEnv()
  const env = await resolveAdvisorLinkFixtureEnv()

  if (!env.advisorUserId || !env.linkedConsumerUserId || !env.linkedConsumerHouseholdId) {
    testInfo.skip(
      true,
      'e2e-consumer-linked + advisor missing — run npm run seed:e2e and set PLAYWRIGHT_CONSUMER_LINK_*',
    )
    return
  }

  advisorUserId = env.advisorUserId
  consumerUserId = env.linkedConsumerUserId
  consumerHouseholdId = env.linkedConsumerHouseholdId
  advisorEmail = env.advisorEmail
  advisorPassword = resolveE2ePassword(
    advisorEmail,
    process.env.PLAYWRIGHT_ADVISOR_PASSWORD,
  )

  await ensureE2eAdvisorFirmSubscriptionActive(advisorUserId)
  await resetLink()
  expect(await getLink(), 'expected no pre-existing link for the pair').toBeFalsy()
})

test.afterAll(async () => {
  if (!advisorUserId || !consumerUserId) return
  await resetLink()
})

test.describe('advisor pending link (consumer_requested) authz', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('pending grants no access; accepting grants access (status is the only variable)', async ({
    request,
  }) => {
    test.skip(!advisorUserId || !consumerUserId || !consumerHouseholdId, 'fixture env missing')

    const consumer = await playwrightRequest.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL,
      storageState: '.auth/consumer-link.json',
    })

    try {
      const invite = await consumer.post('/api/consumer/invite-advisor', {
        data: { advisorEmail },
        timeout: API_TIMEOUT_MS,
      })
      expect(invite.ok(), await invite.text()).toBeTruthy()

      const pending = await getLink()
      expect(pending?.status, 'invite should create consumer_requested').toBe('consumer_requested')
      expect(pending?.accepted_at, 'pending must not be accepted').toBeFalsy()

      // App-layer routes first — advisorReadsProfile() signInWithPassword invalidates cookie session.
      const pendingComposition = await request.post('/api/estate-composition', {
        data: { householdId: consumerHouseholdId, sourceRole: 'advisor' },
        timeout: API_TIMEOUT_MS,
      })
      expectAccessDenied(pendingComposition.status())

      const pendingPayload = await request.get(
        `/api/advisor/client-export-payload?clientId=${consumerUserId}`,
        { timeout: API_TIMEOUT_MS },
      )
      expectAccessDenied(pendingPayload.status())

      expect(
        await advisorReadsProfile(),
        'profiles RLS must hide consumer from a pending advisor',
      ).toBeFalsy()

      const advisorAfterProfileRead = await freshAdvisorApiContext()
      try {
        const accept = await advisorAfterProfileRead.post('/api/advisor/accept-request', {
          data: { advisor_client_id: pending!.id },
          timeout: API_TIMEOUT_MS,
        })
        expect(accept.ok(), await accept.text()).toBeTruthy()

        const active = await getLink()
        expect(active?.status, 'accept-request must set a connected status').toBeTruthy()
        expect(
          (CONNECTED_ADVISOR_CLIENT_STATUSES as readonly string[]).includes(active!.status),
        ).toBeTruthy()
        expect(active?.accepted_at, 'accept-request must set accepted_at').toBeTruthy()

        const activeComposition = await advisorAfterProfileRead.post('/api/estate-composition', {
          data: { householdId: consumerHouseholdId, sourceRole: 'advisor' },
          timeout: API_TIMEOUT_MS,
        })
        const compositionBody = await activeComposition.text()
        expect(activeComposition.ok(), compositionBody).toBeTruthy()

        const activePayload = await advisorAfterProfileRead.get(
          `/api/advisor/client-export-payload?clientId=${consumerUserId}`,
          { timeout: API_TIMEOUT_MS },
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
        await advisorAfterProfileRead.dispose()
      }
    } finally {
      await consumer.dispose()
    }
  })
})
