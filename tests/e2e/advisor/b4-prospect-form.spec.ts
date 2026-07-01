import { test, expect } from '@playwright/test'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'
import {
  ensureAdvisorFirmForE2e,
  ensureE2eAdvisorFirmSubscriptionActive,
  findUserIdByEmail,
  initSupabaseEnv,
} from '../../../scripts/seed-e2e-lib'
import { resolveE2eEmail, resolveE2ePassword, syncE2ePasswordForEmail } from '../helpers/e2e-auth'

/**
 * B4 Prospect Track 1 (steps 3–8, 4b) — form logic + PDF route content.
 * Step 10 (BCC inbox) stays manual.
 */
test.describe.configure({ mode: 'serial', timeout: 120_000 })

test.describe('B4 prospect form logic', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  const advisorEmail = () =>
    resolveE2eEmail(process.env.PLAYWRIGHT_ADVISOR_EMAIL, E2E_IDENTITIES.advisor.email)

  test.beforeAll(async () => {
    initSupabaseEnv()
    const advisorUserId = await findUserIdByEmail(advisorEmail())
    if (!advisorUserId) {
      throw new Error(`b4-prospect-form: no advisor profile for ${advisorEmail()}`)
    }
    await ensureAdvisorFirmForE2e(advisorUserId, E2E_IDENTITIES.advisor.firmName)
    await ensureE2eAdvisorFirmSubscriptionActive(advisorUserId)
  })

  test.beforeEach(async ({ page, context }) => {
    const email = advisorEmail()
    const password = resolveE2ePassword(email, process.env.PLAYWRIGHT_ADVISOR_PASSWORD)
    await syncE2ePasswordForEmail(email, password)
    await context.clearCookies()
    await page.goto('/login')
    await page.waitForSelector('input[id="email"]', { state: 'visible' })
    await page.locator('input[id="email"]').fill(email)
    await page.locator('input[id="password"]').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 90_000 })
  })

  test('CA married business owner — tax figures, sunset delta, no state card', async ({ page }) => {
    await page.goto('/prospect')
    await expect(page.getByRole('heading', { name: 'Prospect Mode' })).toBeVisible()

    await page.locator('input[name="name"]').fill('Test Prospect')
    await page.locator('select').nth(0).selectOption('CA')
    await page.locator('select').nth(1).selectOption('xl')
    await page.locator('select').nth(2).selectOption('married')
    await page.locator('#biz').check()
    await page.getByRole('button', { name: 'Generate Summary' }).click()

    await expect(
      page.getByRole('heading', { name: 'Estate Planning Opportunity Summary' }),
    ).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('Federal — Current law')).toBeVisible()
    const federalCard = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Federal — Current law' }) })
      .first()
    const federalTaxLine = federalCard.locator('p').first()
    await expect(federalTaxLine).toBeVisible()
    const federalText = await federalTaxLine.textContent()
    expect(federalText).not.toBe('$0')
    expect(federalText).not.toBe('—')
    await expect(federalCard.getByText(/Exemption:/).first()).toBeVisible()

    await expect(
      page.getByText(/federal exemption sunsets|sunset/i).first(),
    ).toBeVisible()
    await expect(page.getByText(/CA state estate tax/i)).toHaveCount(0)
  })

  test('WA shows non-zero state estate tax card', async ({ page }) => {
    await page.goto(
      '/prospect?state=WA&range=md&marital=married&biz=1&age=58&name=Test%20Prospect',
    )
    await expect(
      page.getByRole('heading', { name: 'Estate Planning Opportunity Summary' }),
    ).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByText('WA state estate tax', { exact: true })).toBeVisible()
    const taxExposure = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'Tax exposure' }) })
    await expect(taxExposure.getByText('WA state estate tax', { exact: true })).toBeVisible()
    const stateAmount = taxExposure.locator('span.font-semibold.text-amber-700')
    await expect(stateAmount).toBeVisible()
    const stateText = await stateAmount.textContent()
    expect(stateText).not.toBe('$0')
  })

  test('prospect PDF route includes advisor name in header', async ({ request }) => {
    const res = await request.get(
      '/api/advisor/prospect-pdf?state=CA&range=md&marital=married&biz=1&age=58&name=Test%20Prospect',
    )
    expect(res.ok(), await res.text()).toBeTruthy()
    const html = await res.text()
    expect(html).toContain('Prepared by')
    expect(html).toContain(E2E_IDENTITIES.advisor.fullName)
    expect(html).toMatch(/sunset|Sunset/i)
  })
})
