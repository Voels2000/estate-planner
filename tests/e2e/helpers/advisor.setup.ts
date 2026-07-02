import { test as setup } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  ensureAdvisorDirectoryListing,
  ensureAdvisorFirmForE2e,
  ensureE2eAdvisorFirmSubscriptionActive,
  findUserIdByEmail,
} from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail, resolveE2ePassword, syncE2ePasswordForEmail } from './e2e-auth'

setup('authenticate advisor', async ({ page }) => {
  const email = resolveE2eEmail(
    process.env.PLAYWRIGHT_ADVISOR_EMAIL,
    E2E_IDENTITIES.advisor.email,
  )
  const password = resolveE2ePassword(email, process.env.PLAYWRIGHT_ADVISOR_PASSWORD)

  await syncE2ePasswordForEmail(email, password)

  const advisorUserId = await findUserIdByEmail(email)
  if (!advisorUserId) {
    throw new Error(`advisor-setup: no profile for ${email}`)
  }
  await ensureAdvisorFirmForE2e(advisorUserId, E2E_IDENTITIES.advisor.firmName)
  await ensureE2eAdvisorFirmSubscriptionActive(advisorUserId)
  await ensureAdvisorDirectoryListing(advisorUserId)

  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 90_000 })
  await page.context().storageState({ path: '.auth/advisor.json' })
})
