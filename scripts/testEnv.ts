export type TestEnv = 'local' | 'staging' | 'production'

export const STAGING_SUPABASE_PROJECT_REF = 'cmzyxpxfyvdvbsykjvsg'
export const PRODUCTION_SUPABASE_PROJECT_REF = 'fnzvlmrqwcqwiqueevux'

/** Required in .env.test.production before any prod smoke run. */
export const PRODUCTION_ACK_VAR = 'I_KNOW_THIS_IS_PRODUCTION'

export const ENVIRONMENTS = {
  local: { baseURL: 'http://127.0.0.1:3000', envFile: '.env.test.local' },
  staging: {
    baseURL: 'https://estate-planner-staging.vercel.app',
    envFile: '.env.test.staging',
  },
  production: { baseURL: 'https://www.mywealthmaps.com', envFile: '.env.test.production' },
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
export function assertStagingMoneyPathGuard(): void {
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

  const stripeKey =
    process.env.STRIPE_SECRET_KEY?.trim() ??
    process.env.STRIPE_SECRET_KEY_LIVE?.trim() ??
    ''
  if (stripeKey.startsWith('sk_live_')) {
    throw new Error('[money-path guard] STRIPE_SECRET_KEY must be test mode for staging validation')
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const ref = supabaseProjectRef(url)
  console.log(
    `[money-path guard] OK — TEST_ENV=staging, Supabase ref=${ref}, baseURL=${expectedBase}`,
  )
}

export function stagingMoneyPathBaseUrl(): string {
  return ENVIRONMENTS.staging.baseURL
}
