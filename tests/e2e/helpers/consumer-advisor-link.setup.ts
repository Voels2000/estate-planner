/**
 * Establishes a REAL consumer→advisor link through invite→accept-request (registered
 * advisor path). Never a raw INSERT — status/accepted_at are product-set.
 *
 * Depends on: consumer-link-setup, advisor-setup
 * Advisor smokes should depend on this project (not advisor-setup alone).
 */
import { test as setup, expect, request } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ensureE2eAdvisorFirmSubscriptionActive,
  findUserIdByEmail,
  initSupabaseEnv,
  pruneStrayE2eAdvisorClientLinks,
} from '../../../scripts/seed-e2e-lib'
import {
  isConnectedAdvisorLinkStatus,
  resolveAdvisorLinkFixtureEnv,
} from './e2e-advisor-link-env'

const API_TIMEOUT_MS = 30_000

setup('link consumer → registered advisor via invite/accept, assert isolation', async () => {
  const env = await resolveAdvisorLinkFixtureEnv()

  expect(env.advisorUserId, 'e2e advisor user missing — run npm run seed:e2e').toBeTruthy()
  expect(env.linkedConsumerUserId, 'e2e-consumer-linked missing — run npm run seed:e2e').toBeTruthy()
  expect(env.linkedConsumerHouseholdId, 'linked consumer household missing').toBeTruthy()
  expect(env.isolationHouseholdId, 'PLAYWRIGHT_HOUSEHOLD_ID / isolation consumer household missing').toBeTruthy()
  expect(env.isolationConsumerUserId, 'isolation consumer user id missing').toBeTruthy()
  expect(env.linkedConsumerHouseholdId).not.toBe(env.isolationHouseholdId)

  initSupabaseEnv()
  await ensureE2eAdvisorFirmSubscriptionActive(env.advisorUserId)

  const advisorClientUserId =
    (await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)) ?? ''
  await pruneStrayE2eAdvisorClientLinks(env.advisorUserId, [
    advisorClientUserId,
    env.linkedConsumerUserId,
  ])

  const admin = createAdminClient()
  const { data: existingLink } = await admin
    .from('advisor_clients')
    .select('id, status, accepted_at')
    .eq('advisor_id', env.advisorUserId)
    .eq('client_id', env.linkedConsumerUserId)
    .maybeSingle()

  const consumer = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    storageState: '.auth/consumer-link.json',
  })
  const advisor = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    storageState: '.auth/advisor.json',
  })

  try {
    if (!isConnectedAdvisorLinkStatus(existingLink?.status)) {
      if (existingLink?.status === 'consumer_requested') {
        const acceptRes = await advisor.post('/api/advisor/accept-request', {
          data: { advisor_client_id: existingLink.id },
          timeout: API_TIMEOUT_MS,
        })
        expect(acceptRes.ok(), await acceptRes.text()).toBeTruthy()
      } else {
        const inviteRes = await consumer.post('/api/consumer/invite-advisor', {
          data: { advisorEmail: env.advisorEmail },
          timeout: API_TIMEOUT_MS,
        })
        expect(inviteRes.ok(), await inviteRes.text()).toBeTruthy()

        const { data: pending } = await admin
          .from('advisor_clients')
          .select('id')
          .eq('advisor_id', env.advisorUserId)
          .eq('client_id', env.linkedConsumerUserId)
          .eq('status', 'consumer_requested')
          .maybeSingle()

        expect(pending?.id, 'no consumer_requested row after invite').toBeTruthy()

        const acceptRes = await advisor.post('/api/advisor/accept-request', {
          data: { advisor_client_id: pending!.id },
          timeout: API_TIMEOUT_MS,
        })
        expect(acceptRes.ok(), await acceptRes.text()).toBeTruthy()
      }

      const { data: link } = await admin
        .from('advisor_clients')
        .select('status, accepted_at')
        .eq('advisor_id', env.advisorUserId)
        .eq('client_id', env.linkedConsumerUserId)
        .single()

      expect(isConnectedAdvisorLinkStatus(link?.status)).toBeTruthy()
      expect(link?.accepted_at, 'accepted_at must be set by accept-request').toBeTruthy()
    }

    const linkedComposition = await advisor.post('/api/estate-composition', {
      data: { householdId: env.linkedConsumerHouseholdId, sourceRole: 'advisor' },
      timeout: API_TIMEOUT_MS,
    })
    expect(linkedComposition.ok(), await linkedComposition.text()).toBeTruthy()

    const blockedComposition = await advisor.post('/api/estate-composition', {
      data: { householdId: env.isolationHouseholdId, sourceRole: 'advisor' },
      timeout: API_TIMEOUT_MS,
    })
    expect([403, 404], 'advisor must NOT reach isolation-fixture household').toContain(
      blockedComposition.status(),
    )

    const linkedPayload = await advisor.get(
      `/api/advisor/client-export-payload?clientId=${env.linkedConsumerUserId}`,
      { timeout: API_TIMEOUT_MS },
    )
    expect(linkedPayload.status(), 'advisor should reach linked client payload').toBeLessThan(400)

    const blockedPayload = await advisor.get(
      `/api/advisor/client-export-payload?clientId=${env.isolationConsumerUserId}`,
      { timeout: API_TIMEOUT_MS },
    )
    expect([403, 404], 'advisor must NOT reach isolation-fixture client payload').toContain(
      blockedPayload.status(),
    )
  } finally {
    await consumer.dispose()
    await advisor.dispose()
  }
})
