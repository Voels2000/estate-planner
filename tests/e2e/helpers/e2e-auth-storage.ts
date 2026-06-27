/**
 * CI parallel smoke: resolve `.auth/` paths for shared vs per-suite sessions.
 *
 * When E2E_REUSE_AUTH=1 and E2E_SUITE is set, contended roles (consumer, advisor)
 * map to `.auth/<role>.<suite>.json` so parallel jobs never share a refresh token.
 */

export const E2E_SMOKE_SUITES = [
  'go-live-profile',
  'security-smoke',
  'b4-gate',
  'security-isolation',
] as const

export type E2eSmokeSuite = (typeof E2E_SMOKE_SUITES)[number]

/** Identities used concurrently by ≥2 parallel smoke jobs — mint one session per suite. */
export const PER_SUITE_AUTH_ROLES = ['consumer', 'advisor'] as const

export type PerSuiteAuthRole = (typeof PER_SUITE_AUTH_ROLES)[number]

function isPerSuiteRole(role: string): role is PerSuiteAuthRole {
  return (PER_SUITE_AUTH_ROLES as readonly string[]).includes(role)
}

/** Storage path for suite jobs (E2E_REUSE_AUTH) and local dev (falls back to shared). */
export function authStoragePath(role: string): string {
  const suite = process.env.E2E_SUITE?.trim()
  if (
    process.env.E2E_REUSE_AUTH === '1' &&
    suite &&
    isPerSuiteRole(role)
  ) {
    return `.auth/${role}.${suite}.json`
  }
  return `.auth/${role}.json`
}

/** Storage path while minting in e2e-prepare (E2E_MINT_SUITE_AUTH=1 + E2E_SUITE). */
export function authStoragePathForMint(role: string): string {
  const suite = process.env.E2E_SUITE?.trim()
  if (process.env.E2E_MINT_SUITE_AUTH === '1' && suite && isPerSuiteRole(role)) {
    return `.auth/${role}.${suite}.json`
  }
  return `.auth/${role}.json`
}

/** All per-suite auth files prepare must mint and TTL-guard. */
export function ciPerSuiteAuthPaths(): string[] {
  const paths: string[] = []
  for (const suite of E2E_SMOKE_SUITES) {
    if (suite === 'go-live-profile') {
      paths.push(authStoragePathForMintAtSuite('consumer', suite))
      continue
    }
    paths.push(authStoragePathForMintAtSuite('consumer', suite))
    paths.push(authStoragePathForMintAtSuite('advisor', suite))
  }
  return paths
}

function authStoragePathForMintAtSuite(role: PerSuiteAuthRole, suite: E2eSmokeSuite): string {
  return `.auth/${role}.${suite}.json`
}
