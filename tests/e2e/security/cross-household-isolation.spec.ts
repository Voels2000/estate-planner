/**
 * Cross-household IDOR matrix — consumer and advisor must not read foreign households.
 * e2e-consumer is not advisor-linked (pending rec only); advisor-client + tier1 are linked.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  fetchAdvisorClientHouseholdId,
  fetchHouseholdIdByOwnerEmail,
  resolveConsumerHouseholdId,
} from '../helpers/e2e-households'
import { resolveAdvisorLinkFixtureEnv } from '../helpers/e2e-advisor-link-env'
import { createAdminClient } from '@/lib/supabase/admin'
import { findUserIdByEmail, initSupabaseEnv, pruneStrayE2eAdvisorClientLinks } from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail, resolveE2ePassword } from '../helpers/e2e-auth'
import { getWithAuthRetry } from '../helpers/request-auth-retry'
import {
  EXPORT_ISOLATION_MARKER_A,
  EXPORT_ISOLATION_MARKER_B,
  expectExportPayloadContainsMarker,
  expectExportPayloadExcludesMarker,
  seedExportIsolationMarkers,
} from '../helpers/export-isolation-fixture'

const API_TIMEOUT_MS = 30_000

function apiOpts() {
  return { timeout: API_TIMEOUT_MS }
}

/** Routes may return 403 (forbidden) or 404 (not found) for foreign households — both deny access. */
function expectAccessDenied(status: number) {
  expect([403, 404]).toContain(status)
}

test.describe.configure({ mode: 'serial' })

let consumerHouseholdId: string
let advisorClientHouseholdId: string
let linkedClientHouseholdId: string
let advisorForeignHouseholdId: string
let consumerOwnerUserId: string
let advisorClientOwnerUserId: string
let linkedClientOwnerUserId: string
let advisorForeignOwnerUserId: string

test.beforeAll(async ({}, testInfo) => {
  const canAdminLookup =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())

  const consumerEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_EMAIL,
    E2E_IDENTITIES.consumer.email,
  )
  const advisorClientEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_ADVISOR_CLIENT_EMAIL,
    E2E_IDENTITIES.advisorClient.email,
  )
  const linkedConsumerEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_LINK_EMAIL,
    E2E_IDENTITIES.consumerLinked.email,
  )
  const advisorEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_ADVISOR_EMAIL,
    E2E_IDENTITIES.advisor.email,
  )

  consumerHouseholdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim() ?? ''
  advisorClientHouseholdId = process.env.PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID?.trim() ?? ''

  if (canAdminLookup) {
    initSupabaseEnv()
    const canonicalConsumer = (await fetchHouseholdIdByOwnerEmail(consumerEmail)) ?? ''
    const canonicalAdvisorClient = (await fetchAdvisorClientHouseholdId()) ?? ''
    const linkEnv = await resolveAdvisorLinkFixtureEnv()

    if (canonicalConsumer) {
      if (consumerHouseholdId && consumerHouseholdId !== canonicalConsumer) {
        console.warn(
          `[e2e] PLAYWRIGHT_HOUSEHOLD_ID (${consumerHouseholdId}) ≠ consumer (${canonicalConsumer}); using consumer household`,
        )
      }
      consumerHouseholdId = canonicalConsumer
    } else if (!consumerHouseholdId) {
      consumerHouseholdId = (await resolveConsumerHouseholdId()) ?? ''
    }

    if (canonicalAdvisorClient) {
      if (
        advisorClientHouseholdId &&
        advisorClientHouseholdId !== canonicalAdvisorClient
      ) {
        console.warn(
          `[e2e] PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID (${advisorClientHouseholdId}) ≠ canonical (${canonicalAdvisorClient}); using canonical`,
        )
      }
      advisorClientHouseholdId = canonicalAdvisorClient
    } else if (!advisorClientHouseholdId) {
      advisorClientHouseholdId = ''
    }

    consumerOwnerUserId = (await findUserIdByEmail(consumerEmail)) ?? ''
    advisorClientOwnerUserId = (await findUserIdByEmail(advisorClientEmail)) ?? ''
    linkedClientOwnerUserId = (await findUserIdByEmail(linkedConsumerEmail)) ?? ''

    if (process.env.TEST_ENV === 'production') {
      linkedClientHouseholdId = linkEnv.linkedConsumerHouseholdId || consumerHouseholdId
      advisorForeignHouseholdId = linkEnv.isolationHouseholdId || advisorClientHouseholdId
      advisorForeignOwnerUserId = advisorClientOwnerUserId
    } else {
      linkedClientHouseholdId = advisorClientHouseholdId
      advisorForeignHouseholdId = consumerHouseholdId
      advisorForeignOwnerUserId = linkEnv.isolationConsumerUserId || consumerOwnerUserId
    }

    const advisorId = (await findUserIdByEmail(advisorEmail)) ?? ''
    const tier1UserId = (await findUserIdByEmail(E2E_IDENTITIES.consumerTier1.email)) ?? ''
    if (advisorId) {
      await pruneStrayE2eAdvisorClientLinks(advisorId, [
        advisorClientOwnerUserId,
        linkedClientOwnerUserId,
        tier1UserId,
      ].filter(Boolean))
    }
  } else {
    linkedClientHouseholdId = advisorClientHouseholdId
    advisorForeignHouseholdId = consumerHouseholdId
  }

  if (!consumerHouseholdId || !advisorClientHouseholdId) {
    testInfo.skip(
      true,
      'Missing household IDs — run npm run seed:e2e on staging, or set PLAYWRIGHT_HOUSEHOLD_ID / service role for lookup',
    )
    return
  }
  if (!linkedClientHouseholdId) linkedClientHouseholdId = advisorClientHouseholdId
  if (!advisorForeignHouseholdId) advisorForeignHouseholdId = consumerHouseholdId
  expect(consumerHouseholdId).not.toBe(advisorClientHouseholdId)

  if (consumerOwnerUserId && advisorClientOwnerUserId) {
    await seedExportIsolationMarkers(consumerOwnerUserId, advisorClientOwnerUserId)
  }
})

test.describe('Consumer isolation @production', () => {
  test.use({ storageState: '.auth/consumer.json' })

  test('POST gifting-summary on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/gifting-summary', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId, sourceRole: 'consumer' },
    })
    expectAccessDenied(res.status())
  })

  test('GET export-estate-plan on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.get(
      `/api/export-estate-plan?household_id=${advisorClientHouseholdId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })

  test('GET documents on foreign household returns 403 or 404', async ({ request }) => {
    const res = await request.get(`/api/documents/household/${advisorClientHouseholdId}`, apiOpts())
    expectAccessDenied(res.status())
  })

  test('GET data-export is scoped to caller — foreign rows absent when both have data', async ({
    request,
  }) => {
    const res = await request.get('/api/consumer/data-export', apiOpts())
    expect(res.status()).toBe(200)
    const body = await res.text()
    const payload = JSON.parse(body) as { household_id: string | null; tables: Record<string, unknown[]> }
    expect(payload.household_id).toBe(consumerHouseholdId)
    expectExportPayloadContainsMarker(body, EXPORT_ISOLATION_MARKER_A)
    expectExportPayloadExcludesMarker(body, payload, EXPORT_ISOLATION_MARKER_B)
    expect(body).not.toContain(advisorClientHouseholdId)
  })
})

test.describe('Advisor isolation @production', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST gifting-summary on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/gifting-summary', {
      ...apiOpts(),
      data: { householdId: advisorForeignHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorForeignHouseholdId, sourceRole: 'advisor' },
    })
    expectAccessDenied(res.status())
  })

  test('GET export-estate-plan on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.get(
      `/api/export-estate-plan?household_id=${advisorForeignHouseholdId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })

  test('GET client-export-payload for unlinked consumer owner returns 404', async ({ request }) => {
    const foreignOwnerId = advisorForeignOwnerUserId || consumerOwnerUserId
    test.skip(!foreignOwnerId, 'isolation consumer owner user id unavailable')
    const res = await getWithAuthRetry(
      request,
      `/api/advisor/client-export-payload?clientId=${foreignOwnerId}`,
      apiOpts(),
      'advisor-isolation-client-export',
    )
    expectAccessDenied(res.status())
  })
})

test.describe('Advisor access to linked client @production', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST estate-composition on advisor client household returns 200', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: linkedClientHouseholdId, sourceRole: 'advisor' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
  })
})

test.describe('Advisor revoked link lifecycle', () => {
  test.use({ storageState: '.auth/advisor.json' })

  let advisorClientLinkId: string | null = null
  let savedLinkStatus: { status: string; client_status: string | null } | null = null

  test.beforeAll(async ({}, testInfo) => {
    const canAdminLookup =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
    if (!canAdminLookup || !advisorClientOwnerUserId) {
      testInfo.skip(true, 'service role + advisor-client owner required')
      return
    }

    initSupabaseEnv()
    const advisorEmail = resolveE2eEmail(
      process.env.PLAYWRIGHT_ADVISOR_EMAIL,
      E2E_IDENTITIES.advisor.email,
    )
    const advisorId = await findUserIdByEmail(advisorEmail)
    if (!advisorId) {
      testInfo.skip(true, 'e2e advisor missing')
      return
    }

    const admin = createAdminClient()
    const { data: link } = await admin
      .from('advisor_clients')
      .select('id, status, client_status')
      .eq('advisor_id', advisorId)
      .eq('client_id', advisorClientOwnerUserId)
      .maybeSingle()

    advisorClientLinkId = link?.id ?? null
    savedLinkStatus = link
      ? { status: link.status, client_status: link.client_status ?? null }
      : null
  })

  test.afterAll(async () => {
    if (!advisorClientLinkId || !savedLinkStatus) return
    const admin = createAdminClient()
    await admin
      .from('advisor_clients')
      .update({
        status: savedLinkStatus.status,
        client_status: savedLinkStatus.client_status,
      })
      .eq('id', advisorClientLinkId)
  })

  test('advisor loses access after link is revoked', async ({ request }) => {
    test.skip(!advisorClientLinkId, 'e2e advisor→client link missing — run npm run seed:e2e')

    const admin = createAdminClient()
    const { error: revokeError } = await admin
      .from('advisor_clients')
      .update({ status: 'removed', client_status: 'inactive' })
      .eq('id', advisorClientLinkId!)
    expect(revokeError, revokeError?.message).toBeNull()

    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId, sourceRole: 'advisor' },
    })
    expectAccessDenied(res.status())
  })
})

test.describe('Advisor-empty isolation (unlinked book) @production', () => {
  test.use({ storageState: '.auth/advisor-empty.json' })

  test('GET client-export-payload for linked client owner returns 404', async ({ request }) => {
    const linkedOwnerId = linkedClientOwnerUserId || advisorClientOwnerUserId
    test.skip(!linkedOwnerId, 'linked client owner user id unavailable')
    const res = await getWithAuthRetry(
      request,
      `/api/advisor/client-export-payload?clientId=${linkedOwnerId}`,
      apiOpts(),
      'advisor-empty-client-export',
    )
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on advisor client household returns 403 or 404', async ({
    request,
  }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: linkedClientHouseholdId, sourceRole: 'advisor' },
    })
    expectAccessDenied(res.status())
  })
})

/** SECURITY DEFINER views with public grants bypass table RLS — must not be PostgREST-readable. */
test.describe('PostgREST view isolation @production', () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  async function expectLifetimeExemptionViewDenied(client: SupabaseClient, label: string) {
    const { data, error } = await client
      .from('lifetime_exemption_summary')
      .select('household_id')
      .limit(10)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|denied|not authorized|42501/)
      return
    }
    expect(data ?? [], `${label} must not read lifetime_exemption_summary`).toHaveLength(0)
  }

  test('anon client cannot select lifetime_exemption_summary', async () => {
    test.skip(!supabaseUrl || !supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_* required')
    const client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await expectLifetimeExemptionViewDenied(client, 'anon')
  })

  test('authenticated consumer cannot select lifetime_exemption_summary', async () => {
    test.skip(!supabaseUrl || !supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_* required')
    const email = resolveE2eEmail(
      process.env.PLAYWRIGHT_CONSUMER_EMAIL,
      E2E_IDENTITIES.consumer.email,
    )
    const password = resolveE2ePassword(email, process.env.PLAYWRIGHT_CONSUMER_PASSWORD)
    const client = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { error: signInError } = await client.auth.signInWithPassword({ email, password })
    expect(signInError, signInError?.message).toBeNull()
    await expectLifetimeExemptionViewDenied(client, 'authenticated consumer')
  })
})
