/**
 * Shared household/user IDs for cross-household isolation specs.
 * Cached module singleton — safe for parallel describe blocks in one file.
 */
import type { TestInfo } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  fetchAdvisorClientHouseholdId,
  fetchHouseholdIdByOwnerEmail,
  resolveConsumerHouseholdId,
} from './e2e-households'
import { resolveAdvisorLinkFixtureEnv } from './e2e-advisor-link-env'
import { findUserIdByEmail, initSupabaseEnv, pruneStrayE2eAdvisorClientLinks } from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail } from './e2e-auth'
import { seedExportIsolationMarkers } from './export-isolation-fixture'

export type CrossHouseholdIsolationFixture = {
  consumerHouseholdId: string
  advisorClientHouseholdId: string
  linkedClientHouseholdId: string
  advisorForeignHouseholdId: string
  consumerOwnerUserId: string
  advisorClientOwnerUserId: string
  linkedClientOwnerUserId: string
  advisorForeignOwnerUserId: string
}

let cached: CrossHouseholdIsolationFixture | null = null
let skipMessage: string | null = null

export async function getCrossHouseholdIsolationFixture(
  testInfo: TestInfo,
): Promise<CrossHouseholdIsolationFixture> {
  if (skipMessage) {
    testInfo.skip(true, skipMessage)
    throw new Error(skipMessage)
  }
  if (cached) return cached

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

  let consumerHouseholdId = process.env.PLAYWRIGHT_HOUSEHOLD_ID?.trim() ?? ''
  let advisorClientHouseholdId = process.env.PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID?.trim() ?? ''
  let linkedClientHouseholdId = ''
  let advisorForeignHouseholdId = ''
  let consumerOwnerUserId = ''
  let advisorClientOwnerUserId = ''
  let linkedClientOwnerUserId = ''
  let advisorForeignOwnerUserId = ''

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
    skipMessage =
      'Missing household IDs — run npm run seed:e2e on staging, or set PLAYWRIGHT_HOUSEHOLD_ID / service role for lookup'
    testInfo.skip(true, skipMessage)
    throw new Error(skipMessage)
  }

  if (!linkedClientHouseholdId) linkedClientHouseholdId = advisorClientHouseholdId
  if (!advisorForeignHouseholdId) advisorForeignHouseholdId = consumerHouseholdId

  if (consumerHouseholdId === advisorClientHouseholdId) {
    skipMessage = 'Consumer and advisor-client household IDs must differ'
    testInfo.skip(true, skipMessage)
    throw new Error(skipMessage)
  }

  if (consumerOwnerUserId && advisorClientOwnerUserId) {
    await seedExportIsolationMarkers(consumerOwnerUserId, advisorClientOwnerUserId)
  }

  cached = {
    consumerHouseholdId,
    advisorClientHouseholdId,
    linkedClientHouseholdId,
    advisorForeignHouseholdId,
    consumerOwnerUserId,
    advisorClientOwnerUserId,
    linkedClientOwnerUserId,
    advisorForeignOwnerUserId,
  }
  return cached
}

/** Reset cache — unit tests only. */
export function resetCrossHouseholdIsolationFixtureCache(): void {
  cached = null
  skipMessage = null
}
