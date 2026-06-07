/**
 * Ensures Playwright advisor account has E2E advisor client linked.
 *
 * Usage:
 *   SEED_ADVISOR_EMAIL=e2e-advisor@mywealthmaps.test npm run seed:e2e
 *   # or re-seed client only:
 *   npx tsx scripts/seed-michael-johnson-advisor-demo.ts
 */

import { E2E_IDENTITIES } from './e2e-test-identities'
import { findUserIdByEmail, initSupabaseEnv } from './seed-e2e-lib'

const ADVISOR2_EMAIL = E2E_IDENTITIES.advisor.email

async function main() {
  initSupabaseEnv()
  const advisorId = await findUserIdByEmail(ADVISOR2_EMAIL)
  const clientId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)

  if (!advisorId) {
    console.error(`Advisor not found: ${ADVISOR2_EMAIL} — run npm run seed:e2e`)
    process.exit(1)
  }

  if (!clientId) {
    console.error(
      `Advisor client not found: ${E2E_IDENTITIES.advisorClient.email} — run npm run seed:e2e`,
    )
    process.exit(1)
  }

  console.log(`Advisor ${ADVISOR2_EMAIL} → client ${E2E_IDENTITIES.advisorClient.email}`)
  console.log(`  /advisor/clients/${clientId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
