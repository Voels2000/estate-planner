/**
 * Stripe guard call-site tests — prove callers halt, not just that the guard throws in isolation.
 * Run: npx playwright test tests/unit/stripeAccountGuardCallSite.spec.ts --project=import-unit
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect } from '@playwright/test'
import {
  PRODUCTION_ACK_VAR,
  PRODUCTION_SUPABASE_PROJECT_REF,
  STAGING_SUPABASE_PROJECT_REF,
  assertPlaywrightEnvGuard,
  assertStagingMoneyPathGuard,
  assertStripeAccountGuard,
  runPlaywrightStartupGuards,
  stripLeakedProductionSecrets,
} from '../../scripts/testEnv'

const MONEY_PATH_GUARD_CALL_SITES = [
  'scripts/verify-pr5-staging-gate.ts',
  'scripts/run-plan-export-2a-purchase.ts',
] as const

function stagingEnvForGuard() {
  process.env.TEST_ENV = 'staging'
  process.env.SUPABASE_URL = `https://${STAGING_SUPABASE_PROJECT_REF}.supabase.co`
  delete process.env.PLAYWRIGHT_BASE_URL
}

function productionEnvForGuard() {
  process.env.TEST_ENV = 'production'
  process.env.PLAYWRIGHT_BASE_URL = 'https://www.mywealthmaps.com'
  process.env.SUPABASE_URL = `https://${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`
  process.env[PRODUCTION_ACK_VAR] = 'yes'
}

test.describe('stripe guard call sites (PR-A seams)', () => {
  let tempDir: string
  const repoRoot = process.cwd()
  const envSnapshot: Record<string, string | undefined> = {}

  test.beforeEach(() => {
    for (const key of [
      'TEST_ENV',
      'STRIPE_SECRET_KEY',
      'STRIPE_SECRET_KEY_LIVE',
      'SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_URL',
      'PLAYWRIGHT_BASE_URL',
      'PLAYWRIGHT_SKIP_ENV_GUARD',
      PRODUCTION_ACK_VAR,
    ]) {
      envSnapshot[key] = process.env[key]
    }
  })

  test.afterEach(() => {
    if (tempDir) process.chdir(repoRoot)
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  test('production smoke rejects staging .test identity fallback', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-callsite-'))
    process.chdir(tempDir)
    delete process.env.PLAYWRIGHT_SKIP_ENV_GUARD
    productionEnvForGuard()
    writeFileSync(
      '.env.test.production',
      `${PRODUCTION_ACK_VAR}=yes\nPLAYWRIGHT_CONSUMER_EMAIL=canary-consumer@mywealthmaps.com\n`,
    )
    process.env.PLAYWRIGHT_CONSUMER_EMAIL = 'e2e-consumer@mywealthmaps.test'
    process.env.PLAYWRIGHT_CONSUMER_PASSWORD = 'test-password-12'
    process.env.PLAYWRIGHT_ADVISOR_EMAIL = 'canary-advisor@mywealthmaps.com'
    process.env.PLAYWRIGHT_ADVISOR_PASSWORD = 'test-password-12'
    process.env.PLAYWRIGHT_ADVISOR_EMPTY_EMAIL = 'canary-advisor-empty@mywealthmaps.com'
    process.env.PLAYWRIGHT_ADVISOR_EMPTY_PASSWORD = 'test-password-12'
    process.env.PLAYWRIGHT_ADVISOR_CLIENT_EMAIL = 'canary-advisor-client@mywealthmaps.com'
    process.env.PLAYWRIGHT_HOUSEHOLD_ID = '19743472-0000-4000-8000-000000000001'
    process.env.PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID = '8d469266-0000-4000-8000-000000000001'

    expect(() => assertPlaywrightEnvGuard()).toThrow(/@mywealthmaps\.com canaries/)
  })

  test('seam 1: production shell sk_live_ fails at runPlaywrightStartupGuards before strip', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-callsite-'))
    process.chdir(tempDir)
    delete process.env.PLAYWRIGHT_SKIP_ENV_GUARD
    productionEnvForGuard()
    writeFileSync('.env.test.production', `${PRODUCTION_ACK_VAR}=yes\n`)
    process.env.STRIPE_SECRET_KEY = 'sk_live_stale_shell_export_not_in_file'

    await expect(runPlaywrightStartupGuards()).rejects.toThrow(/STRIPE_SECRET_KEY/)
    expect(process.env.STRIPE_SECRET_KEY).toBe('sk_live_stale_shell_export_not_in_file')
  })

  test('non-prod leaked sk_live_ hard-fails at stripe guard (strip is production-only, distinct role)', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-callsite-'))
    process.chdir(tempDir)
    stagingEnvForGuard()
    writeFileSync('.env.test.staging', 'STRIPE_SECRET_KEY=sk_live_leaked_live_mode_key\n')
    process.env.STRIPE_SECRET_KEY = 'sk_live_leaked_live_mode_key'

    await expect(assertStripeAccountGuard('staging')).rejects.toThrow(/expects test mode/)
    expect(process.env.STRIPE_SECRET_KEY).toBe('sk_live_leaked_live_mode_key')

    process.env.TEST_ENV = 'production'
    process.env.STRIPE_SECRET_KEY = 'sk_live_removed_by_strip___'
    stripLeakedProductionSecrets()
    expect(process.env.STRIPE_SECRET_KEY).toBeUndefined()
  })

  test('seam 2: awaited assertStagingMoneyPathGuard halts verify gate before stripe work', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-callsite-'))
    process.chdir(tempDir)
    stagingEnvForGuard()
    writeFileSync('.env.test.staging', 'STRIPE_SECRET_KEY=sk_test_from_env_file12\n')
    process.env.STRIPE_SECRET_KEY = 'sk_test_shell_override_key'

    let stripeWorkReached = false
    await expect(async () => {
      await assertStagingMoneyPathGuard()
      stripeWorkReached = true
    }).rejects.toThrow(/STRIPE_SECRET_KEY mismatch/)
    expect(stripeWorkReached).toBe(false)
  })

  test('seam 3: Check C fail-closed halts money-path guard before stripe work', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-callsite-'))
    process.chdir(tempDir)
    stagingEnvForGuard()
    const matchedKey = 'sk_test_checkc_callsite1'
    writeFileSync('.env.test.staging', `STRIPE_SECRET_KEY=${matchedKey}\n`)
    process.env.STRIPE_SECRET_KEY = matchedKey

    let stripeWorkReached = false
    await expect(async () => {
      await assertStagingMoneyPathGuard({
        retrieveAccount: async () => {
          throw new Error('StripeConnectionError: connection reset')
        },
      })
      stripeWorkReached = true
    }).rejects.toThrow(/\(fail-closed\):/)
    expect(stripeWorkReached).toBe(false)
  })

  test('seam 2: un-awaited money-path guard lets caller proceed (false-pass shape)', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-callsite-'))
    process.chdir(tempDir)
    stagingEnvForGuard()
    writeFileSync('.env.test.staging', 'STRIPE_SECRET_KEY=sk_test_from_env_file12\n')
    process.env.STRIPE_SECRET_KEY = 'sk_test_shell_override_key'

    let callerProceeded = false
    void assertStagingMoneyPathGuard().catch(() => {
      // guard rejects async — caller must still await; swallow so the test can observe proceed
    })
    await new Promise((resolve) => setTimeout(resolve, 25))
    callerProceeded = true

    expect(callerProceeded).toBe(true)
  })

  test('guard call sites await async guards (grep)', () => {
    for (const rel of MONEY_PATH_GUARD_CALL_SITES) {
      const src = readFileSync(join(repoRoot, rel), 'utf8')
      expect(src, `${rel} must await money-path guard`).toMatch(/await assertStagingMoneyPathGuard\(\)/)
      expect(src, `${rel} must not pass Check C test deps`).not.toMatch(
        /assertStagingMoneyPathGuard\s*\(\s*\{/,
      )
    }
    const globalSetup = readFileSync(join(repoRoot, 'tests/e2e/globalSetup.ts'), 'utf8')
    expect(globalSetup).toMatch(/await runPlaywrightStartupGuards\(\)/)
    expect(globalSetup).not.toMatch(/assertPlaywrightEnvGuard\(\)/)

    const testEnvSrc = readFileSync(join(repoRoot, 'scripts/testEnv.ts'), 'utf8')
    const guardBody = testEnvSrc.match(
      /export async function assertStripeAccountGuard\([\s\S]*?^}/m,
    )?.[0]
    const identityBody = testEnvSrc.match(
      /export async function assertStripeAccountIdentity\([\s\S]*?^}/m,
    )?.[0]
    expect(guardBody).toBeTruthy()
    expect(identityBody).toBeTruthy()
    expect(guardBody).toMatch(/await assertStripeAccountIdentity\(testEnv, key, testDeps\)/)
    expect(identityBody).toMatch(
      /deps\?\.retrieveAccount[\s\S]*?: await stripe\.accounts\.retrieve\(\)/,
    )
    expect(testEnvSrc).toMatch(/await assertStripeAccountGuard\(testEnv\)/)
    expect(testEnvSrc).toMatch(/await assertStripeAccountGuard\('staging', testDeps\)/)
    expect(testEnvSrc).not.toMatch(/await assertStripeAccountGuard\([^)]+,\s*\{/)
  })
})
