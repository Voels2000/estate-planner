/**
 * Resolve canonical E2E household IDs from staging Supabase and patch .env.test.local.
 * CI GitHub secrets for PLAYWRIGHT_HOUSEHOLD_ID can drift after seed:e2e; this keeps
 * security-isolation and go-live-profile aligned with e2e-consumer / advisor-client.
 * Also prunes stray advisor→e2e-consumer links (cast topology: pending rec only).
 *
 * Called from e2e-prepare after seed:e2e:persona-matrix (service role in env).
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { E2E_IDENTITIES } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv, pruneStrayE2eAdvisorClientLinks } from './seed-e2e-lib'
import {
  fetchAdvisorClientHouseholdId,
  fetchHouseholdIdByOwnerEmail,
} from '../tests/e2e/helpers/e2e-households'

const envFile = join(process.cwd(), '.env.test.local')

function upsertEnvLine(contents: string, key: string, value: string): string {
  const line = `${key}=${value}`
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  if (pattern.test(contents)) {
    return contents.replace(pattern, line)
  }
  return `${contents.trimEnd()}\n${line}\n`
}

async function main() {
  const consumerId = await fetchHouseholdIdByOwnerEmail(E2E_IDENTITIES.consumer.email)
  const advisorClientId = await fetchAdvisorClientHouseholdId()
  const consumerLinkHouseholdId = await fetchHouseholdIdByOwnerEmail(
    E2E_IDENTITIES.consumerLinked.email,
  )
  const consumerPendingHouseholdId = await fetchHouseholdIdByOwnerEmail(
    E2E_IDENTITIES.consumerPending.email,
  )

  if (!consumerId || !advisorClientId) {
    console.error(
      'Could not resolve E2E household IDs — run npm run seed:e2e on staging first.',
    )
    process.exit(1)
  }

  if (!consumerLinkHouseholdId) {
    console.error(
      'Could not resolve e2e-consumer-linked household — seed with --only=consumer-linked (or full seed:e2e).',
    )
    process.exit(1)
  }

  if (!consumerPendingHouseholdId) {
    console.error(
      'Could not resolve e2e-consumer-pending household — seed with --only=consumer-pending (or persona-matrix).',
    )
    process.exit(1)
  }

  let contents = readFileSync(envFile, 'utf8')
  const prevConsumer = contents.match(/^PLAYWRIGHT_HOUSEHOLD_ID=(.*)$/m)?.[1]?.trim()
  if (prevConsumer && prevConsumer !== consumerId) {
    console.warn(
      `[ci] PLAYWRIGHT_HOUSEHOLD_ID secret (${prevConsumer}) ≠ canonical consumer (${consumerId}); patching .env.test.local`,
    )
  }

  contents = upsertEnvLine(contents, 'PLAYWRIGHT_HOUSEHOLD_ID', consumerId)
  contents = upsertEnvLine(contents, 'PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID', advisorClientId)
  contents = upsertEnvLine(contents, 'PLAYWRIGHT_CONSUMER_LINK_HOUSEHOLD_ID', consumerLinkHouseholdId)
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_CONSUMER_PENDING_HOUSEHOLD_ID',
    consumerPendingHouseholdId,
  )
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_CONSUMER_PENDING_EMAIL',
    E2E_IDENTITIES.consumerPending.email,
  )
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_CONSUMER_PENDING_PASSWORD',
    E2E_IDENTITIES.consumerPending.password,
  )
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_ADVISOR_PENDING_EMAIL',
    E2E_IDENTITIES.advisorPending.email,
  )
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_ADVISOR_PENDING_PASSWORD',
    E2E_IDENTITIES.advisorPending.password,
  )
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_CONSUMER_LINK_EMAIL',
    E2E_IDENTITIES.consumerLinked.email,
  )
  contents = upsertEnvLine(
    contents,
    'PLAYWRIGHT_CONSUMER_LINK_PASSWORD',
    E2E_IDENTITIES.consumerLinked.password,
  )

  initSupabaseEnv()
  const advisorId = await findUserIdByEmail(E2E_IDENTITIES.advisor.email)
  const advisorClientUserId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
  const tier1UserId = await findUserIdByEmail(E2E_IDENTITIES.consumerTier1.email)
  const consumerLinkUserId = await findUserIdByEmail(E2E_IDENTITIES.consumerLinked.email)
  const consumerPendingUserId = await findUserIdByEmail(E2E_IDENTITIES.consumerPending.email)
  const advisorPendingUserId = await findUserIdByEmail(E2E_IDENTITIES.advisorPending.email)

  if (advisorId) {
    contents = upsertEnvLine(contents, 'PLAYWRIGHT_ADVISOR_USER_ID', advisorId)
    await pruneStrayE2eAdvisorClientLinks(
      advisorId,
      [advisorClientUserId, tier1UserId, consumerLinkUserId, consumerPendingUserId].filter(
        (id): id is string => Boolean(id),
      ),
    )
  }
  if (advisorPendingUserId) {
    contents = upsertEnvLine(contents, 'PLAYWRIGHT_ADVISOR_PENDING_USER_ID', advisorPendingUserId)
  }
  if (consumerLinkUserId) {
    contents = upsertEnvLine(contents, 'PLAYWRIGHT_CONSUMER_LINK_USER_ID', consumerLinkUserId)
  }
  if (consumerPendingUserId) {
    contents = upsertEnvLine(contents, 'PLAYWRIGHT_CONSUMER_PENDING_USER_ID', consumerPendingUserId)
  }

  writeFileSync(envFile, contents)

  console.log(`[ci] PLAYWRIGHT_HOUSEHOLD_ID=${consumerId}`)
  console.log(`[ci] PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID=${advisorClientId}`)
  console.log(`[ci] PLAYWRIGHT_CONSUMER_LINK_HOUSEHOLD_ID=${consumerLinkHouseholdId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
