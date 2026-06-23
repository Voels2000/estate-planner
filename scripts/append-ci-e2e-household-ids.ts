/**
 * Resolve canonical E2E household IDs from staging Supabase and patch .env.test.local.
 * CI GitHub secrets for PLAYWRIGHT_HOUSEHOLD_ID can drift after seed:e2e; this keeps
 * security-isolation and go-live-profile aligned with e2e-consumer / advisor-client.
 * Also prunes stray advisor→e2e-consumer links (cast topology: pending rec only).
 *
 * Called from scripts/write-ci-staging-env.sh (service role already in env).
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

  if (!consumerId || !advisorClientId) {
    console.error(
      'Could not resolve E2E household IDs — run npm run seed:e2e on staging first.',
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
  writeFileSync(envFile, contents)

  initSupabaseEnv()
  const advisorId = await findUserIdByEmail(E2E_IDENTITIES.advisor.email)
  const advisorClientUserId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
  const tier1UserId = await findUserIdByEmail(E2E_IDENTITIES.consumerTier1.email)
  if (advisorId) {
    await pruneStrayE2eAdvisorClientLinks(
      advisorId,
      [advisorClientUserId, tier1UserId].filter((id): id is string => Boolean(id)),
    )
  }

  console.log(`[ci] PLAYWRIGHT_HOUSEHOLD_ID=${consumerId}`)
  console.log(`[ci] PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID=${advisorClientId}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
