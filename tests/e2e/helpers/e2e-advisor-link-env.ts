import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  fetchHouseholdIdByOwnerEmail,
  resolveConsumerHouseholdId,
} from './e2e-households'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail } from './e2e-auth'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'

export type PendingLinkFixtureEnv = {
  advisorEmail: string
  pendingConsumerEmail: string
  pendingConsumerUserId: string
  pendingConsumerHouseholdId: string
  advisorUserId: string
}

/** Resolve IDs for 5c pending-link authz (consumer-pending ↔ advisor-pending — never shared smokes). */
export async function resolvePendingLinkFixtureEnv(): Promise<PendingLinkFixtureEnv> {
  initSupabaseEnv()

  const advisorEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_ADVISOR_PENDING_EMAIL,
    E2E_IDENTITIES.advisorPending.email,
  )
  const pendingConsumerEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_PENDING_EMAIL,
    E2E_IDENTITIES.consumerPending.email,
  )

  const advisorUserId = (await findUserIdByEmail(advisorEmail)) ?? ''
  const pendingConsumerUserId = (await findUserIdByEmail(pendingConsumerEmail)) ?? ''

  const pendingConsumerHouseholdId =
    process.env.PLAYWRIGHT_CONSUMER_PENDING_HOUSEHOLD_ID?.trim() ||
    (await fetchHouseholdIdByOwnerEmail(pendingConsumerEmail)) ||
    ''

  return {
    advisorEmail,
    pendingConsumerEmail,
    pendingConsumerUserId,
    pendingConsumerHouseholdId,
    advisorUserId,
  }
}

export type AdvisorLinkFixtureEnv = {
  advisorEmail: string
  linkedConsumerEmail: string
  linkedConsumerUserId: string
  linkedConsumerHouseholdId: string
  isolationConsumerUserId: string
  isolationHouseholdId: string
  advisorUserId: string
}

/** Resolve canonical IDs for the invite→accept link fixture (from seed + env). */
export async function resolveAdvisorLinkFixtureEnv(): Promise<AdvisorLinkFixtureEnv> {
  initSupabaseEnv()

  const advisorEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_ADVISOR_EMAIL,
    E2E_IDENTITIES.advisor.email,
  )
  const linkedConsumerEmail = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_LINK_EMAIL,
    E2E_IDENTITIES.consumerLinked.email,
  )

  const advisorUserId = (await findUserIdByEmail(advisorEmail)) ?? ''
  const linkedConsumerUserId = (await findUserIdByEmail(linkedConsumerEmail)) ?? ''
  const isolationConsumerUserId =
    (await findUserIdByEmail(
      resolveE2eEmail(process.env.PLAYWRIGHT_CONSUMER_EMAIL, E2E_IDENTITIES.consumer.email),
    )) ?? ''

  const linkedConsumerHouseholdId =
    process.env.PLAYWRIGHT_CONSUMER_LINK_HOUSEHOLD_ID?.trim() ||
    (await fetchHouseholdIdByOwnerEmail(linkedConsumerEmail)) ||
    ''

  const isolationHouseholdId =
    process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim() ||
    (await resolveConsumerHouseholdId()) ||
    ''

  return {
    advisorEmail,
    linkedConsumerEmail,
    linkedConsumerUserId,
    linkedConsumerHouseholdId,
    isolationConsumerUserId,
    isolationHouseholdId,
    advisorUserId,
  }
}

export function isConnectedAdvisorLinkStatus(status: string | null | undefined): boolean {
  return (
    status != null &&
    (CONNECTED_ADVISOR_CLIENT_STATUSES as readonly string[]).includes(status)
  )
}
