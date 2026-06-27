import { defineConfig, devices, type Project } from '@playwright/test'
import { ENVIRONMENTS, getTestEnvConfig } from './scripts/testEnv'
import { authStoragePath } from './tests/e2e/helpers/e2e-auth-storage'

function loadTestEnvConfig(): { baseURL: string; envFile: string } {
  if (!process.env.TEST_ENV) {
    process.env.TEST_ENV = 'local'
  }
  try {
    const config = getTestEnvConfig()
    process.env.PLAYWRIGHT_BASE_URL = config.baseURL
    return config
  } catch {
    const config = ENVIRONMENTS.local
    process.env.PLAYWRIGHT_BASE_URL = config.baseURL
    return config
  }
}

const { baseURL, envFile } = loadTestEnvConfig()

const useLocalWebServer =
  baseURL.includes('127.0.0.1') || baseURL.includes('localhost')

const hasTier1Consumer =
  Boolean(
    (process.env.E2E_TIER1_EMAIL ?? process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL)?.trim(),
  ) &&
  Boolean(
    (process.env.E2E_TIER1_PASSWORD ?? process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD)?.trim(),
  )

const setupTimeout = 120_000

const TEST_ENV = process.env.TEST_ENV ?? 'local'

const REUSE_AUTH = process.env.E2E_REUSE_AUTH === '1'

/** Minted once in e2e-prepare; suite jobs reuse `.auth/` from the prepare tarball. */
const CI_SHARED_SETUP_PROJECTS = [
  'consumer-setup',
  'advisor-setup',
  'advisor-empty-setup',
  'advisor-pending-setup',
  'consumer-link-setup',
  'consumer-pending-setup',
  'consumer-advisor-link-setup',
]

function scrubSharedSetupProjects(projects: Project[]): Project[] {
  if (!REUSE_AUTH) return projects
  return projects
    .filter((p) => !CI_SHARED_SETUP_PROJECTS.includes(p.name ?? ''))
    .map((p) => ({
      ...p,
      dependencies: (p.dependencies ?? []).filter(
        (d) => !CI_SHARED_SETUP_PROJECTS.includes(d),
      ),
    }))
}

// INTERIM: prod has no advisor role-canary yet, so these have nothing to pass
// against. Remove once the advisor↔consumer canary pair lands (Track 2).
const PROD_SMOKE_EXCLUDE = new Set([
  'advisor-setup',
  'advisor-empty-setup',
  'consumer-link-setup',
  'consumer-advisor-link-setup',
  'advisor',
])

function resolveProjects(all: Project[]): Project[] {
  if (TEST_ENV !== 'production') return all
  return all
    .filter((p) => !PROD_SMOKE_EXCLUDE.has(p.name ?? ''))
    .map((p) => {
      if (p.name !== 'security') return p
      return { ...p, dependencies: ['consumer-setup'] }
    })
}

function buildProjects(): Project[] {
  const projects: Project[] = [
    { name: 'advisor-setup', testMatch: /helpers\/advisor\.setup\.ts/, timeout: setupTimeout },
    { name: 'advisor-empty-setup', testMatch: /helpers\/advisor-empty\.setup\.ts/, timeout: setupTimeout },
    { name: 'advisor-pending-setup', testMatch: /helpers\/advisor-pending\.setup\.ts/, timeout: setupTimeout },
    { name: 'consumer-setup', testMatch: /helpers\/consumer\.setup\.ts/, timeout: setupTimeout },
    { name: 'consumer-canceled-setup', testMatch: /helpers\/consumer-canceled\.setup\.ts/, timeout: setupTimeout },
    { name: 'attorney-setup', testMatch: /helpers\/attorney\.setup\.ts/, timeout: setupTimeout },
    { name: 'advisor-client-setup', testMatch: /helpers\/advisor-client\.setup\.ts/, timeout: setupTimeout },
    { name: 'consumer-link-setup', testMatch: /helpers\/consumer-link\.setup\.ts/, timeout: setupTimeout },
    { name: 'consumer-pending-setup', testMatch: /helpers\/consumer-pending\.setup\.ts/, timeout: setupTimeout },
    {
      name: 'consumer-advisor-link-setup',
      dependencies: ['consumer-link-setup', 'advisor-setup'],
      testMatch: /helpers\/consumer-advisor-link\.setup\.ts/,
      timeout: setupTimeout,
    },
    {
      name: 'security',
      dependencies: ['consumer-setup', 'consumer-link-setup', 'consumer-pending-setup', 'advisor-setup', 'advisor-pending-setup', 'advisor-empty-setup'],
      testMatch: /security\/.*\.spec\.ts/,
      testIgnore: /advisor-empty-route-repro\.spec\.ts/,
    },
    {
      name: 'security-repro',
      dependencies: ['consumer-setup', 'advisor-empty-setup'],
      testMatch: /advisor-empty-route-repro\.spec\.ts/,
    },
    {
      name: 'advisor',
      dependencies: ['consumer-advisor-link-setup'],
      testMatch: /advisor\/.*\.spec\.ts/,
      testIgnore: /advisor-consumer-sync\.spec\.ts/,
      use: { storageState: authStoragePath('advisor') },
    },
    {
      name: 'advisor-sync',
      dependencies: ['advisor-setup', 'advisor-client-setup'],
      testMatch: /advisor\/advisor-consumer-sync\.spec\.ts/,
      use: { storageState: authStoragePath('advisor') },
    },
    {
      name: 'consumer',
      dependencies: ['consumer-setup'],
      testMatch: /consumer\/.*\.spec\.ts/,
      testIgnore: /consumer-tier1-gates\.spec\.ts|consumer-tier0-gates\.spec\.ts|golden-path-show-all-tools\.spec\.ts|onboarding-persona\.spec\.ts|consumer-deliverable-persona-matrix\.spec\.ts/,
      use: { storageState: authStoragePath('consumer') },
    },
    {
      name: 'consumer-onboarding',
      testMatch: /consumer\/onboarding-persona\.spec\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'golden-path',
      testMatch: /golden-path-show-all-tools\.spec\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: 'attorney',
      dependencies: ['attorney-setup'],
      testMatch: /attorney\/.*\.spec\.ts/,
      use: { storageState: '.auth/attorney.json' },
    },
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.ts/,
    },
    {
      name: 'import-unit',
      testDir: './tests/unit',
      testMatch: /(import|wizard-onboarding-gate|guided-onboarding-href|type-normalizer|projectionReadiness|estate-health-score|prospectSummary|advisorPlaybookStorage|simpleRateLimit|waitlist-mode|signupAdmission|signupPolicy|site-url|roth-analysis|tax-year-selection|privilegedMfaPolicy|verifyEnv|stripeWebhookVerify|stripePricesProdGuard|stripeAccountGuard|stripeAccountGuardCallSite|deleteUserSchema|waRegime|attorneyClientCap|consumerCheckoutBlockReason|processConsumerCheckout|requirePaidDownloadAccess|oneTimePurchases|stripeOneTimeSkus|planExportWarnings|planExportAppTrialDeliverable|shouldOfferPlanAndExportPurchase|app-url|internalApiAuth|applyEmailUnsubscribe|monteCarloAssumptionsFromRow|estateHouseholdAlerts|cronDripEligibility|readGpcOptOut|promotionSchemaVerification|consumerSubscriptionStatus|subscriptionPeriod|stripeIds|activateConsumerSubscription|resolveEffectiveTier|hasEverSubscribed|inputComputedBoundary|inputExportPayload|netWorthSummary|tier0Dashboard|armGate1VerifyFixture|canUnlockDashboard|projectionsContentSplit|getUserAccessProfile|retireStripeConsumerTrial|e2ePersonaMatrix).*\.spec\.ts/,
      use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
      },
    },
  ]

  if (hasTier1Consumer) {
    projects.push(
      {
        name: 'consumer-tier1-setup',
        testMatch: /helpers\/consumer-tier1\.setup\.ts/,
        timeout: setupTimeout,
      },
      {
        name: 'consumer-tier1',
        dependencies: ['consumer-tier1-setup'],
        testMatch: /consumer-tier1-gates\.spec\.ts|consumer-tier1-billing-checkout\.spec\.ts/,
        use: { storageState: '.auth/consumer-tier1.json' },
      },
    )
  }

  projects.push({
    name: 'consumer-tier0',
    dependencies: ['consumer-canceled-setup'],
    testMatch: /consumer-tier0-gates\.spec\.ts|consumer-tier0-dashboard\.spec\.ts/,
    use: { storageState: '.auth/consumer-canceled.json' },
  })

  projects.push(
    {
      name: 'consumer-app-trial-setup',
      testMatch: /helpers\/consumer-app-trial\.setup\.ts/,
      timeout: setupTimeout,
    },
    {
      name: 'consumer-app-trial',
      dependencies: ['consumer-app-trial-setup'],
      testMatch: /consumer-deliverable-persona-matrix\.spec\.ts/,
      grep: /B4 —/,
      use: { storageState: '.auth/consumer-app-trial.json' },
    },
    {
      name: 'consumer-plan-export-setup',
      testMatch: /helpers\/consumer-plan-export\.setup\.ts/,
      timeout: setupTimeout,
    },
    {
      name: 'consumer-plan-export',
      dependencies: ['consumer-plan-export-setup'],
      testMatch: /consumer-deliverable-persona-matrix\.spec\.ts/,
      grep: /B3 —/,
      use: { storageState: '.auth/consumer-plan-export.json' },
    },
    {
      name: 'consumer-deliverable-tier3',
      dependencies: ['consumer-setup'],
      testMatch: /consumer-deliverable-persona-matrix\.spec\.ts/,
      grep: /B5 —/,
      use: { storageState: '.auth/consumer.json' },
    },
  )

  return scrubSharedSetupProjects(resolveProjects(projects))
}

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: require.resolve('./tests/e2e/globalSetup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: buildProjects(),
  webServer:
    useLocalWebServer && process.env.PLAYWRIGHT_SKIP_WEBSERVER !== '1'
      ? {
        // Load the test env file so E2E_SKIP_RECOMPUTE reaches the Next server (not just Playwright).
        command: `dotenv -o -e .env.local -e ${envFile} -- npm run start`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: process.env.E2E_DIAG_ROUTE_AUTH
          ? { E2E_DIAG_ROUTE_AUTH: process.env.E2E_DIAG_ROUTE_AUTH }
          : undefined,
      }
    : undefined,
})
