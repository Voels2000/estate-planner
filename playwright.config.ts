import { defineConfig, devices, type Project } from '@playwright/test'
import { E2E_DEFAULT_BASE_URL } from './scripts/e2e-test-identities'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? E2E_DEFAULT_BASE_URL

const useLocalWebServer =
  baseURL.includes('127.0.0.1') || baseURL.includes('localhost')

const hasTier1Consumer =
  Boolean(process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL) &&
  Boolean(process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD)

const setupTimeout = 120_000

const projects: Project[] = [
  { name: 'advisor-setup', testMatch: /helpers\/advisor\.setup\.ts/, timeout: setupTimeout },
  { name: 'advisor-empty-setup', testMatch: /helpers\/advisor-empty\.setup\.ts/, timeout: setupTimeout },
  { name: 'consumer-setup', testMatch: /helpers\/consumer\.setup\.ts/, timeout: setupTimeout },
  { name: 'attorney-setup', testMatch: /helpers\/attorney\.setup\.ts/, timeout: setupTimeout },
  { name: 'advisor-client-setup', testMatch: /helpers\/advisor-client\.setup\.ts/, timeout: setupTimeout },
  {
    name: 'security',
    dependencies: ['consumer-setup', 'advisor-setup', 'advisor-empty-setup'],
    testMatch: /security\/.*\.spec\.ts/,
  },
  {
    name: 'advisor',
    dependencies: ['advisor-setup'],
    testMatch: /advisor\/.*\.spec\.ts/,
    testIgnore: /advisor-consumer-sync\.spec\.ts/,
    use: { storageState: '.auth/advisor.json' },
  },
  {
    name: 'advisor-sync',
    dependencies: ['advisor-setup', 'advisor-client-setup'],
    testMatch: /advisor\/advisor-consumer-sync\.spec\.ts/,
    use: { storageState: '.auth/advisor.json' },
  },
  {
    name: 'consumer',
    dependencies: ['consumer-setup'],
    testMatch: /consumer\/.*\.spec\.ts/,
    testIgnore: /consumer-tier1-gates\.spec\.ts|golden-path-show-all-tools\.spec\.ts|onboarding-persona\.spec\.ts/,
    use: { storageState: '.auth/consumer.json' },
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
    testMatch: /(import|wizard-onboarding-gate|guided-onboarding-href|type-normalizer|projectionReadiness|estate-health-score|prospectSummary|advisorPlaybookStorage|simpleRateLimit|waitlist-mode|signupAdmission|signupPolicy|roth-analysis|tax-year-selection|privilegedMfaPolicy|verifyEnv|stripeWebhookVerify|stripePricesProdGuard|deleteUserSchema|waRegime|attorneyClientCap|consumerCheckoutBlockReason|processConsumerCheckout|internalApiAuth|applyEmailUnsubscribe|monteCarloAssumptionsFromRow|estateHouseholdAlerts|cronDripEligibility|readGpcOptOut|promotionSchemaVerification|consumerSubscriptionStatus|subscriptionPeriod|stripeIds|activateConsumerSubscription).*\.spec\.ts/,
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

export default defineConfig({
  testDir: './tests/e2e',
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
  projects,
  webServer: useLocalWebServer
    ? {
        // Load .env.test so E2E_SKIP_RECOMPUTE reaches the Next server (not just Playwright).
        command: 'dotenv -o -e .env.local -e .env.test -- npm run start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
})
