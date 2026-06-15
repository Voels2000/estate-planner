/**
 * Cross-household IDOR matrix — consumer and advisor must not read foreign households.
 * Requires PLAYWRIGHT_HOUSEHOLD_ID (e2e-consumer) and seeded E2E advisor client.
 */
import { test, expect } from '@playwright/test'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  fetchAdvisorClientHouseholdId,
  fetchHouseholdIdByOwnerEmail,
} from '../helpers/e2e-households'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail, resolveE2ePassword } from '../helpers/e2e-auth'

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
let consumerOwnerUserId: string
let advisorClientOwnerUserId: string

test.beforeAll(async ({}, testInfo) => {
  const canAdminLookup =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())

  consumerHouseholdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim() ?? ''
  advisorClientHouseholdId = process.env.PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID?.trim() ?? ''

  if (!consumerHouseholdId && canAdminLookup) {
    consumerHouseholdId =
      (await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email)) ?? ''
  }
  if (!advisorClientHouseholdId && canAdminLookup) {
    advisorClientHouseholdId = (await fetchAdvisorClientHouseholdId()) ?? ''
  }

  if (!consumerHouseholdId || !advisorClientHouseholdId) {
    testInfo.skip(
      true,
      'Missing household IDs — create .env.test.prod (see .env.test.prod.example): copy PLAYWRIGHT_HOUSEHOLD_ID and PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID from .env.test, or add Supabase service role for lookup',
    )
    return
  }
  expect(consumerHouseholdId).not.toBe(advisorClientHouseholdId)

  if (canAdminLookup) {
    initSupabaseEnv()
    consumerOwnerUserId = (await findUserIdByEmail(E2E_IDENTITIES.consumer.email)) ?? ''
    advisorClientOwnerUserId = (await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)) ?? ''
  }
})

test.describe('@production', () => {
test.describe('Consumer isolation', () => {
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
})

test.describe('Advisor isolation', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST gifting-summary on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/gifting-summary', {
      ...apiOpts(),
      data: { householdId: consumerHouseholdId },
    })
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: consumerHouseholdId, sourceRole: 'advisor' },
    })
    expectAccessDenied(res.status())
  })

  test('GET export-estate-plan on e2e-consumer household returns 403 or 404', async ({ request }) => {
    const res = await request.get(
      `/api/export-estate-plan?household_id=${consumerHouseholdId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })

  test('GET client-export-payload for unlinked consumer owner returns 404', async ({ request }) => {
    test.skip(!consumerOwnerUserId, 'consumer owner user id unavailable')
    const res = await request.get(
      `/api/advisor/client-export-payload?clientId=${consumerOwnerUserId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })
})

test.describe('Advisor access to linked client', () => {
  test.use({ storageState: '.auth/advisor.json' })

  test('POST estate-composition on advisor client household returns 200', async ({ request }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId, sourceRole: 'advisor' },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
  })
})

test.describe('Advisor-empty isolation (unlinked book)', () => {
  test.use({ storageState: '.auth/advisor-empty.json' })

  test('GET client-export-payload for linked client owner returns 404', async ({ request }) => {
    test.skip(!advisorClientOwnerUserId, 'advisor-client owner user id unavailable')
    const res = await request.get(
      `/api/advisor/client-export-payload?clientId=${advisorClientOwnerUserId}`,
      apiOpts(),
    )
    expectAccessDenied(res.status())
  })

  test('POST estate-composition on advisor client household returns 403 or 404', async ({
    request,
  }) => {
    const res = await request.post('/api/estate-composition', {
      ...apiOpts(),
      data: { householdId: advisorClientHouseholdId, sourceRole: 'advisor' },
    })
    expectAccessDenied(res.status())
  })
})
})

/** SECURITY DEFINER views with public grants bypass table RLS — must not be PostgREST-readable. */
test.describe('PostgREST view isolation', () => {
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
