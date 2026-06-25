/**
 * Stripe account guard — mode, env-file source, account identity checks.
 * Run: npx playwright test tests/unit/stripeAccountGuard.spec.ts --project=import-unit
 */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { test, expect } from '@playwright/test'
import {
  ENVIRONMENTS,
  STRIPE_MAIN_ACCOUNT_ID,
  assertStripeAccountIdentity,
  assertStripeKeyMode,
  assertStripeKeySource,
  readStripeSecretKeyFromEnvFile,
} from '../../scripts/testEnv'

test.describe('stripe account guard', () => {
  test('ENVIRONMENTS maps staging and production to same account, different mode', () => {
    expect(ENVIRONMENTS.staging.stripeAccountId).toBe(STRIPE_MAIN_ACCOUNT_ID)
    expect(ENVIRONMENTS.production.stripeAccountId).toBe(STRIPE_MAIN_ACCOUNT_ID)
    expect(ENVIRONMENTS.staging.stripeMode).toBe('test')
    expect(ENVIRONMENTS.production.stripeMode).toBe('live')
    expect(ENVIRONMENTS.local.stripeAccountId).toBe(ENVIRONMENTS.staging.stripeAccountId)
  })

  test.describe('assertStripeKeyMode (Check A)', () => {
    test('rejects sk_live_ under staging', () => {
      expect(() => assertStripeKeyMode('sk_live_abc', 'staging')).toThrow(
        /expects test mode \(sk_test_\)/,
      )
    })

    test('rejects sk_test_ under production', () => {
      expect(() => assertStripeKeyMode('sk_test_abc', 'production')).toThrow(
        /expects live mode \(sk_live_\)/,
      )
    })

    test('accepts sk_test_ under staging', () => {
      expect(() => assertStripeKeyMode('sk_test_abc', 'staging')).not.toThrow()
    })
  })

  test.describe('assertStripeKeySource (Check B)', () => {
    let tempDir: string
    const originalCwd = process.cwd()

    test.beforeEach(() => {
      tempDir = mkdtempSync(join(tmpdir(), 'stripe-guard-'))
      process.chdir(tempDir)
    })

    test.afterEach(() => {
      process.chdir(originalCwd)
    })

    test('detects shell override when file and active key differ', () => {
      writeFileSync('.env.test.staging', 'STRIPE_SECRET_KEY=sk_test_file1234\n')
      expect(() => assertStripeKeySource('staging', 'sk_test_shell5678')).toThrow(
        /STRIPE_SECRET_KEY mismatch/,
      )
    })

    test('passes when file and active key match', () => {
      writeFileSync('.env.test.staging', 'STRIPE_SECRET_KEY=sk_test_samekey12\n')
      expect(() => assertStripeKeySource('staging', 'sk_test_samekey12')).not.toThrow()
    })

    test('reads quoted values from env file', () => {
      writeFileSync('.env.test.staging', 'STRIPE_SECRET_KEY="sk_test_quoted12"\n')
      expect(readStripeSecretKeyFromEnvFile('.env.test.staging')).toBe('sk_test_quoted12')
    })
  })

  test.describe('assertStripeAccountIdentity (Check C)', () => {
    const stagingKey = 'sk_test_checkc_staging12'
    const expectedAccount = ENVIRONMENTS.staging.stripeAccountId

    test('rejects when accounts.retrieve returns wrong account id', async () => {
      const wrongId = 'acct_WRONG_SANDBOX'
      await expect(
        assertStripeAccountIdentity('staging', stagingKey, {
          retrieveAccount: async () => ({ id: wrongId }),
        }),
      ).rejects.toThrow(
        new RegExp(
          `STRIPE_SECRET_KEY belongs to ${wrongId}.*expects ${expectedAccount}`,
        ),
      )
    })

    test('fail-closed on Stripe API error — throws, does not skip', async () => {
      let retrieveCalls = 0
      await expect(
        assertStripeAccountIdentity('staging', stagingKey, {
          retrieveAccount: async () => {
            retrieveCalls += 1
            throw new Error('StripeConnectionError: connection reset')
          },
        }),
      ).rejects.toThrow(
        /\[stripe account guard\] Could not retrieve Stripe account for TEST_ENV=staging \(fail-closed\):/,
      )
      expect(retrieveCalls).toBe(1)
    })

    test('passes when retrieve returns canonical account id', async () => {
      await expect(
        assertStripeAccountIdentity('staging', stagingKey, {
          retrieveAccount: async () => ({ id: expectedAccount }),
        }),
      ).resolves.toBeUndefined()
    })
  })
})
