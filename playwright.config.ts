import { defineConfig, devices } from '@playwright/test'

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? 'https://estate-planner-gules.vercel.app'

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
  projects: [
    { name: 'advisor-setup', testMatch: /helpers\/advisor\.setup\.ts/ },
    { name: 'consumer-setup', testMatch: /helpers\/consumer\.setup\.ts/ },
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
      use: { storageState: '.auth/consumer.json' },
    },
    {
      name: 'public',
      testMatch: /public\/.*\.spec\.ts/,
    },
  ],
})
