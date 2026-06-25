import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import Stripe from 'stripe'

export type TestEnv = 'local' | 'staging' | 'production'

export const STAGING_SUPABASE_PROJECT_REF = 'cmzyxpxfyvdvbsykjvsg'
export const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

/** Main Stripe account — test and live modes share this id; mode is enforced separately. */
export const STRIPE_MAIN_ACCOUNT_ID = 'acct_1TAIt0ENTkKmTNa3'

/** Required in .env.test.production before any prod smoke run. */
export const PRODUCTION_ACK_VAR = 'I_KNOW_THIS_IS_PRODUCTION'

export const ENVIRONMENTS = {
  local: {
    baseURL: 'http://127.0.0.1:3000',
    envFile: '.env.test.local',
    stripeMode: 'test',
    stripeAccountId: STRIPE_MAIN_ACCOUNT_ID,
    stripeAccountLabel: 'main account test mode',
  },
  staging: {
    baseURL: 'https://estate-planner-staging.vercel.app',
    envFile: '.env.test.staging',
    stripeMode: 'test',
    stripeAccountId: STRIPE_MAIN_ACCOUNT_ID,
    stripeAccountLabel: 'main account test mode',
  },
  production: {
    baseURL: 'https://www.mywealthmaps.com',
    envFile: '.env.test.production',
    stripeMode: 'live',
    stripeAccountId: STRIPE_MAIN_ACCOUNT_ID,
    stripeAccountLabel: 'main account live mode',
  },
} as const

export function resolveTestEnv(): TestEnv {
  const v = process.env.TEST_ENV
  if (v === 'local' || v === 'staging' || v === 'production') return v
  throw new Error(`TEST_ENV must be local | staging | production. Got: ${JSON.stringify(v)}`)
}

function supabaseProjectRef(url: string): string | null {
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null
}

/** Map lean staging secret names onto legacy Playwright / Supabase env keys. */
export function applyTestEnvAliases(): void {
  if (process.env.E2E_TIER1_EMAIL && !process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL) {
    process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL = process.env.E2E_TIER1_EMAIL
  }
  if (process.env.E2E_TIER1_PASSWORD && !process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD) {
    process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD = process.env.E2E_TIER1_PASSWORD
  }
  if (process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL
  }
}

function assertSupabaseRef(expectedRef: string, label: TestEnv): void {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = supabaseProjectRef(url)
  if (ref !== expectedRef) {
    throw new Error(
      `[E2E env guard] TEST_ENV=${label} must use Supabase ref ${expectedRef}, got ${ref ?? 'unset'}`,
    )
  }
}

/** Local Playwright runs against localhost but seeds/auth against staging Supabase. */
export function assertLocalSecretsConsistency(): void {
  if (process.env.TEST_ENV !== 'local') return
  assertSupabaseRef(STAGING_SUPABASE_PROJECT_REF, 'local')
}

export function assertStagingSecretsConsistency(): void {
  if (process.env.TEST_ENV !== 'staging') return
  assertSupabaseRef(STAGING_SUPABASE_PROJECT_REF, 'staging')
}

export function assertProductionSecretsConsistency(): void {
  if (process.env.TEST_ENV !== 'production') return
  assertSupabaseRef(PRODUCTION_SUPABASE_PROJECT_REF, 'production')
}

export function assertProductionSmokeReadOnly(): void {
  const violations: string[] = []

  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    violations.push('SUPABASE_SERVICE_ROLE_KEY (production smoke is browser + anon only)')
  }

  const stripeKey =
    process.env.STRIPE_SECRET_KEY?.trim() ??
    process.env.STRIPE_SECRET_KEY_LIVE?.trim() ??
    ''
  if (stripeKey) {
    violations.push('STRIPE_SECRET_KEY / STRIPE_SECRET_KEY_LIVE (runner must not call live Stripe)')
  }
  if (stripeKey.startsWith('sk_live_')) {
    violations.push('sk_live_ Stripe key')
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = supabaseProjectRef(url)
  if (ref && ref !== PRODUCTION_SUPABASE_PROJECT_REF) {
    violations.push(
      `Supabase ref must be ${PRODUCTION_SUPABASE_PROJECT_REF} for production smoke, got ${ref}`,
    )
  }

  if (violations.length > 0) {
    throw new Error(
      `[E2E env guard] Production smoke must be read-only. Remove from ${ENVIRONMENTS.production.envFile}: ${violations.join('; ')}`,
    )
  }
}

/**
 * Fail loud before any browser test — TEST_ENV, base URL, Supabase ref, and prod ack must align.
 */
export function assertPlaywrightEnvGuard(): void {
  let testEnv: TestEnv
  try {
    testEnv = resolveTestEnv()
  } catch (err) {
    throw new Error(
      `[E2E env guard] ${err instanceof Error ? err.message : String(err)} Load via npm run test:e2e / test:e2e:staging / test:e2e:prod:smoke.`,
    )
  }

  prepareTestEnv()

  const { baseURL: expectedBaseURL, envFile } = ENVIRONMENTS[testEnv]
  const actualBaseURL = process.env.PLAYWRIGHT_BASE_URL ?? ''

  if (actualBaseURL !== expectedBaseURL) {
    throw new Error(
      `[E2E env guard] TEST_ENV=${testEnv} expects baseURL ${expectedBaseURL} but PLAYWRIGHT_BASE_URL is ${actualBaseURL || 'unset'}. Check ${envFile} and npm script (no stale shell PLAYWRIGHT_BASE_URL).`,
    )
  }

  if (testEnv === 'local') {
    if (!actualBaseURL.includes('127.0.0.1') && !actualBaseURL.includes('localhost')) {
      throw new Error(
        `[E2E env guard] TEST_ENV=local must target localhost, got ${actualBaseURL}`,
      )
    }
    assertLocalSecretsConsistency()
  }

  if (testEnv === 'staging') {
    if (!actualBaseURL.includes('estate-planner-staging.vercel.app')) {
      throw new Error(
        `[E2E env guard] TEST_ENV=staging must target estate-planner-staging.vercel.app, got ${actualBaseURL}`,
      )
    }
    assertStagingSecretsConsistency()
  }

  if (testEnv === 'production') {
    if (process.env[PRODUCTION_ACK_VAR] !== 'yes') {
      throw new Error(
        `[E2E env guard] TEST_ENV=production requires ${PRODUCTION_ACK_VAR}=yes in ${envFile} before running prod smoke.`,
      )
    }
    if (!actualBaseURL.includes('mywealthmaps.com')) {
      throw new Error(
        `[E2E env guard] TEST_ENV=production must target www.mywealthmaps.com, got ${actualBaseURL}`,
      )
    }
    assertProductionSecretsConsistency()
    assertProductionSmokeReadOnly()
  }
}

/**
 * Playwright globalSetup guard chain — Stripe guard before prepareTestEnv/strip so shell
 * exports fail loud instead of being deleted and skipped.
 */
export async function runPlaywrightStartupGuards(): Promise<void> {
  if (process.env.PLAYWRIGHT_SKIP_ENV_GUARD === '1') return
  const testEnv = resolveTestEnv()
  await assertStripeAccountGuard(testEnv)
  assertPlaywrightEnvGuard()
}

/** Prod smoke: env file is source of truth — drop privileged keys that leak from the shell. */
export function stripLeakedProductionSecrets(): void {
  if (process.env.TEST_ENV !== 'production') return
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.STRIPE_SECRET_KEY
  delete process.env.STRIPE_SECRET_KEY_LIVE
}

export function prepareTestEnv(): void {
  applyTestEnvAliases()
  stripLeakedProductionSecrets()
  assertLocalSecretsConsistency()
  assertStagingSecretsConsistency()
}

export function getTestEnvConfig() {
  prepareTestEnv()
  const env = resolveTestEnv()
  return { env, ...ENVIRONMENTS[env] }
}

/**
 * Fail loud before staging money-path validation scripts (2a/2b/2c).
 * Unlike Playwright, these scripts must never trust PLAYWRIGHT_BASE_URL from an env file.
 * Invoke via: TEST_ENV=staging dotenv -e .env.test.staging -- npx tsx scripts/...
 * Do NOT use dotenv -o — file must not override shell TEST_ENV or inject localhost URLs.
 */
export async function assertStagingMoneyPathGuard(): Promise<void> {
  if (process.env.TEST_ENV !== 'staging') {
    throw new Error(
      '[money-path guard] TEST_ENV must be staging (set in shell before dotenv). Got: ' +
        JSON.stringify(process.env.TEST_ENV),
    )
  }

  prepareTestEnv()
  assertStagingSecretsConsistency()

  const staleBase = process.env.PLAYWRIGHT_BASE_URL?.trim()
  const expectedBase = ENVIRONMENTS.staging.baseURL
  if (staleBase && staleBase !== expectedBase) {
    throw new Error(
      `[money-path guard] PLAYWRIGHT_BASE_URL=${staleBase} conflicts with staging (${expectedBase}). ` +
        'Remove PLAYWRIGHT_BASE_URL from .env.test.staging — base URL is derived from ENVIRONMENTS.',
    )
  }
  process.env.PLAYWRIGHT_BASE_URL = expectedBase

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = supabaseProjectRef(url)
  console.log(
    `[money-path guard] OK — TEST_ENV=staging, Supabase ref=${ref}, baseURL=${expectedBase}`,
  )

  await assertStripeAccountGuard('staging')
}

export function stagingMoneyPathBaseUrl(): string {
  return ENVIRONMENTS.staging.baseURL
}

/** Read STRIPE_SECRET_KEY directly from the env file (not process.env). */
export function readStripeSecretKeyFromEnvFile(envFile: string): string | null {
  const path = join(process.cwd(), envFile)
  if (!existsSync(path)) return null
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq).trim() !== 'STRIPE_SECRET_KEY') continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  return null
}

function activeStripeSecretKey(): string {
  return (
    process.env.STRIPE_SECRET_KEY?.trim() ?? process.env.STRIPE_SECRET_KEY_LIVE?.trim() ?? ''
  )
}

/** True when any Stripe secret is in process.env — guard runs on presence, not on load path. */
export function isStripeSecretKeyPresent(): boolean {
  return activeStripeSecretKey().length > 0
}

function stripeKeyLast4(key: string): string {
  return key.length >= 4 ? key.slice(-4) : key
}

/** Check A — key mode (sk_test_ vs sk_live_) must match TEST_ENV. */
export function assertStripeKeyMode(key: string, testEnv: TestEnv): void {
  const expected = ENVIRONMENTS[testEnv].stripeMode
  const isLive = key.startsWith('sk_live_')
  const isTest = key.startsWith('sk_test_')
  if (expected === 'test' && isLive) {
    throw new Error(
      `STRIPE_SECRET_KEY is a sk_live_ (LIVE) key, but TEST_ENV=${testEnv} expects test mode (sk_test_). Refusing to run against live Stripe.`,
    )
  }
  if (expected === 'live' && isTest) {
    throw new Error(
      `STRIPE_SECRET_KEY is a sk_test_ (TEST) key, but TEST_ENV=${testEnv} expects live mode (sk_live_). Refusing to run against test Stripe.`,
    )
  }
  if (!isLive && !isTest) {
    throw new Error(
      `[stripe account guard] STRIPE_SECRET_KEY has unrecognized prefix for TEST_ENV=${testEnv}`,
    )
  }
}

/** Check B — active key must match the env file (catches shell-export overrides). */
export function assertStripeKeySource(testEnv: TestEnv, activeKey: string): void {
  const { envFile } = ENVIRONMENTS[testEnv]
  const fileKey = readStripeSecretKeyFromEnvFile(envFile)
  if (!fileKey) {
    throw new Error(
      `STRIPE_SECRET_KEY is set (…${stripeKeyLast4(activeKey)}) but ${envFile} has no STRIPE_SECRET_KEY line. ` +
        'A shell-exported STRIPE_SECRET_KEY is likely in use. Run \'unset STRIPE_SECRET_KEY\' or add the key to the env file.',
    )
  }
  if (fileKey !== activeKey) {
    throw new Error(
      `STRIPE_SECRET_KEY mismatch: ${envFile} has …${stripeKeyLast4(fileKey)}, but the active value is …${stripeKeyLast4(activeKey)}. ` +
        'A shell-exported STRIPE_SECRET_KEY (or earlier-loaded env) is overriding the file. ' +
        "Run 'unset STRIPE_SECRET_KEY' or remove the export from your shell profile (.zshrc/.zprofile).",
    )
  }
}

/** Check C — key must belong to the canonical Stripe account for TEST_ENV. Fail-closed on API error. */
export async function assertStripeAccountIdentity(testEnv: TestEnv, key: string): Promise<void> {
  const { stripeAccountId, stripeAccountLabel } = ENVIRONMENTS[testEnv]
  const stripe = new Stripe(key)
  let accountId: string
  try {
    const account = await stripe.accounts.retrieve()
    accountId = account.id
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `[stripe account guard] Could not retrieve Stripe account for TEST_ENV=${testEnv} (fail-closed): ${msg}`,
    )
  }
  if (accountId !== stripeAccountId) {
    throw new Error(
      `STRIPE_SECRET_KEY belongs to ${accountId}; TEST_ENV=${testEnv} expects ${stripeAccountId} (${stripeAccountLabel}). ` +
        'Wrong sandbox — sessions created by this environment will not be visible to this key.',
    )
  }
}

/**
 * Fail loud before any Stripe API call — mode, env-file source, and account identity.
 * Runs whenever a key is present in process.env (any source). Skips only when absent.
 * Must run before stripLeakedProductionSecrets() so shell exports cannot slip through.
 */
export async function assertStripeAccountGuard(testEnv: TestEnv): Promise<void> {
  const key = activeStripeSecretKey()
  if (!key) return

  assertStripeKeyMode(key, testEnv)
  assertStripeKeySource(testEnv, key)
  await assertStripeAccountIdentity(testEnv, key)

  console.log(
    `[stripe account guard] OK — TEST_ENV=${testEnv}, mode=${ENVIRONMENTS[testEnv].stripeMode}, account=${ENVIRONMENTS[testEnv].stripeAccountId}`,
  )
}

/** One-shot helper: load env, retrieve account id, print for populating ENVIRONMENTS. */
export async function printStripeAccountInfo(testEnv: TestEnv): Promise<void> {
  const key = activeStripeSecretKey()
  if (!key) {
    console.log(JSON.stringify({ testEnv, error: 'STRIPE_SECRET_KEY unset' }, null, 2))
    return
  }
  const mode = key.startsWith('sk_live_') ? 'live' : key.startsWith('sk_test_') ? 'test' : 'unknown'
  try {
    const stripe = new Stripe(key)
    const account = await stripe.accounts.retrieve()
    console.log(
      JSON.stringify(
        { testEnv, keyLast4: stripeKeyLast4(key), mode, accountId: account.id },
        null,
        2,
      ),
    )
  } catch (err) {
    console.log(
      JSON.stringify(
        {
          testEnv,
          keyLast4: stripeKeyLast4(key),
          mode,
          error: err instanceof Error ? err.message : String(err),
        },
        null,
        2,
      ),
    )
  }
}
