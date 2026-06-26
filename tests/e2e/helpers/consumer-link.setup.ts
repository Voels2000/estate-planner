import { test as setup } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import { resolveE2eEmail, resolveE2ePassword, syncE2ePasswordForEmail } from './e2e-auth'

setup('authenticate linked-consumer fixture', async ({ page }) => {
  const email = resolveE2eEmail(
    process.env.PLAYWRIGHT_CONSUMER_LINK_EMAIL,
    E2E_IDENTITIES.consumerLinked.email,
  )
  const password = resolveE2ePassword(
    email,
    process.env.PLAYWRIGHT_CONSUMER_LINK_PASSWORD ?? process.env.PLAYWRIGHT_CONSUMER_PASSWORD,
  )

  await syncE2ePasswordForEmail(email, password)

  await page.goto('/login')
  await page.waitForSelector('input[id="email"]', { state: 'visible' })
  await page.locator('input[id="email"]').fill(email)
  await page.locator('input[id="password"]').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  try {
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 60_000 })
  } catch {
    const loginError = await page
      .locator('form p.text-red-600, form p.text-red-400')
      .first()
      .textContent()
      .catch(() => null)
    throw new Error(
      `Linked consumer login did not leave /login (url=${page.url()})${
        loginError ? `: ${loginError.trim()}` : ''
      }. Run npm run seed:e2e and confirm PLAYWRIGHT_CONSUMER_LINK_EMAIL is seeded.`,
    )
  }

  await page.context().storageState({ path: '.auth/consumer-link.json' })
})
