/**
 * Verify e2e credentials against Supabase Auth (same project as .env.test URL).
 *
 *   npm run verify:e2e-auth
 */
import { E2E_IDENTITIES } from './e2e-test-identities'
import { initSupabaseEnv } from './seed-e2e-lib'

async function main() {
  initSupabaseEnv()
  const { verifyE2eSignIn, resolveE2ePassword } = await import('../tests/e2e/helpers/e2e-auth')

  const checks = [
    E2E_IDENTITIES.consumer.email,
    E2E_IDENTITIES.advisor.email,
    E2E_IDENTITIES.attorneyPortal.email,
  ]

  for (const email of checks) {
    const password = resolveE2ePassword(email)
    await verifyE2eSignIn(email, password)
    console.log(`  OK  ${email}`)
  }

  console.log('\nAll e2e sign-ins succeeded.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
