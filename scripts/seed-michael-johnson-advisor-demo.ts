/**
 * @deprecated Use seedE2eAdvisorClientHousehold via npm run seed:e2e
 * Thin wrapper for manual re-seed of advisor client only.
 */
import { E2E_IDENTITIES } from './e2e-test-identities'
import {
  ensureAuthUser,
  findUserIdByEmail,
  initSupabaseEnv,
  seedE2eAdvisorClientHousehold,
} from './seed-e2e-lib'

async function main() {
  initSupabaseEnv()
  const advisorEmail = process.env.SEED_ADVISOR_EMAIL?.trim() ?? E2E_IDENTITIES.advisor.email
  const advisorId = await findUserIdByEmail(advisorEmail)
  if (!advisorId) {
    console.error('Advisor not found — run npm run seed:e2e first')
    process.exit(1)
  }

  const clientId = await ensureAuthUser({
    email: E2E_IDENTITIES.advisorClient.email,
    password: E2E_IDENTITIES.advisorClient.password,
    fullName: E2E_IDENTITIES.advisorClient.fullName,
    role: 'consumer',
  })

  const householdId = await seedE2eAdvisorClientHousehold(clientId, advisorId)
  console.log('\nDone.')
  console.log('  Advisor:', advisorEmail)
  console.log('  Client:', E2E_IDENTITIES.advisorClient.email)
  console.log('  Household:', householdId)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
