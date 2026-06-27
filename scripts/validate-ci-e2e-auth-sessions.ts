/**
 * CI prepare gate: fingerprint refresh tokens and validate each minted session via
 * getUser() before tarballing. Does NOT call refreshSession() on tarball-bound files
 * (that would rotate server-side refresh tokens and invalidate the shipped sessions).
 */
import { initSupabaseEnv } from './seed-e2e-lib'
import {
  checkStorageStateGetUser,
  findDuplicateRefreshTokens,
  type StorageStateGetUserCheck,
} from './ci-e2e-auth-getuser'

const ADVISOR_AUTH_FILES = [
  '.auth/advisor.json',
  '.auth/advisor.security-smoke.json',
  '.auth/advisor.b4-gate.json',
  '.auth/advisor.security-isolation.json',
] as const

const CONSUMER_PER_SUITE_FILES = [
  '.auth/consumer.go-live-profile.json',
  '.auth/consumer.security-smoke.json',
  '.auth/consumer.b4-gate.json',
  '.auth/consumer.security-isolation.json',
] as const

const ADVISOR_PER_SUITE_FILES = [
  '.auth/advisor.security-smoke.json',
  '.auth/advisor.b4-gate.json',
  '.auth/advisor.security-isolation.json',
] as const

async function main() {
  initSupabaseEnv()

  console.log(
    JSON.stringify({
      diag: 'ci-auth-validate-start',
      gate: 'getUser-only (refreshSession skipped — would rotate tarball refresh tokens)',
      note:
        'Compare advisor vs consumer getUser health. Mint-order getUser snapshots during API mint show which earlier files die after later mints. Check Supabase Dashboard → Auth → refresh token rotation.',
    }),
  )

  const advisorChecks: StorageStateGetUserCheck[] = []
  for (const path of ADVISOR_AUTH_FILES) {
    advisorChecks.push(await checkStorageStateGetUser(path, 'advisor'))
  }

  const consumerChecks: StorageStateGetUserCheck[] = []
  for (const path of CONSUMER_PER_SUITE_FILES) {
    consumerChecks.push(await checkStorageStateGetUser(path, 'consumer'))
  }

  for (const check of [...advisorChecks, ...consumerChecks]) {
    console.log(JSON.stringify({ diag: 'ci-auth-session-check', ...check }))
  }

  const advisorDupes = findDuplicateRefreshTokens(ADVISOR_AUTH_FILES)
  if (advisorDupes.length > 0) {
    console.error(
      JSON.stringify({
        diag: 'ci-auth-duplicate-refresh-tokens',
        role: 'advisor',
        paths: advisorDupes,
      }),
    )
  }

  const consumerDupes = findDuplicateRefreshTokens(CONSUMER_PER_SUITE_FILES)
  if (consumerDupes.length > 0) {
    console.error(
      JSON.stringify({
        diag: 'ci-auth-duplicate-refresh-tokens',
        role: 'consumer',
        paths: consumerDupes,
      }),
    )
  }

  const failures: string[] = []

  if (advisorDupes.length > 0) {
    failures.push(`advisor files share refresh tokens: ${advisorDupes.join(', ')}`)
  }

  for (const path of ADVISOR_PER_SUITE_FILES) {
    const check = advisorChecks.find((c) => c.path === path)
    if (!check) continue
    if (!check.getUserOk) {
      failures.push(`${path}: getUser failed (${check.getUserError ?? 'unknown'})`)
    }
  }

  const advisorPerSuiteGetUserDead = ADVISOR_PER_SUITE_FILES.filter((path) => {
    const check = advisorChecks.find((c) => c.path === path)
    return check && !check.getUserOk
  })
  const consumerPerSuiteGetUserDead = CONSUMER_PER_SUITE_FILES.filter((path) => {
    const check = consumerChecks.find((c) => c.path === path)
    return check && !check.getUserOk
  })

  console.log(
    JSON.stringify({
      diag: 'ci-auth-validate-summary',
      advisorPerSuiteGetUserDead,
      consumerPerSuiteGetUserDead,
      advisorBrowserLoginGetUserOk: advisorChecks.find((c) => c.path === '.auth/advisor.json')
        ?.getUserOk,
    }),
  )

  if (failures.length > 0) {
    console.error('CI auth session validation failed:\n' + failures.map((f) => `  - ${f}`).join('\n'))
    process.exit(1)
  }

  console.log(
    'CI auth session validation passed (all advisor per-suite sessions authenticate via getUser).',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
