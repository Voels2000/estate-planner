import { defineConfig, devices, type Project } from '@playwright/test'

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://estate-planner-gules.vercel.app'

const hasTier1Consumer =
  Boolean(process.env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL) &&
  Boolean(process.env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD)

const setupTimeout = 120_000

const projects: Project[] = [
  { name: 'advisor-setup', testMatch: /helpers\/advisor\.setup\.ts/, timeout: setupTimeout },
  { name: 'consumer-setup', testMatch: /helpers\/consumer\.setup\.ts/, timeout: setupTimeout },
  { name: 'attorney-setup', testMatch: /helpers\/attorney\.setup\.ts/, timeout: setupTimeout },
  {
    name: 'advisor',
    dependencies: ['advisor-setup'],
    testMatch: /advisor\/.*\.spec\.ts/,
    use: { storageState: '.auth/advisor.json' },
  },
  {
    name: 'consumer',
    dependencies: ['consumer-setup'],
    testMatch: /consumer\/.*\.spec\.ts/,
    testIgnore: /consumer-tier1-gates\.spec\.ts|golden-path-show-all-tools\.spec\.ts/,
    use: { storageState: '.auth/consumer.json' },
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
    testMatch: /(import|wizard-onboarding-gate|type-normalizer|projectionReadiness|estate-health-score|prospectSummary|advisorPlaybookStorage).*\.spec\.ts/,
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
      testMatch: /consumer-tier1-gates\.spec\.ts/,
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
})
