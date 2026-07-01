/**
 * Reset unclaimed directory listings for claim magic-link staging walks.
 *
 *   TEST_ENV=staging dotenv -o -e .env.test.staging -- npx tsx scripts/reset-staging-e2e-directory-claim.ts
 */

import { initSupabaseEnv } from './seed-e2e-lib'
import { resetDirectoryClaimWalkFixture } from './directory-claim-walk-reset'

async function main() {
  initSupabaseEnv()
  await resetDirectoryClaimWalkFixture()
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
