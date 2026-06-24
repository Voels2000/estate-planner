#!/usr/bin/env npx tsx
import { chromium } from 'playwright'
import { assertStagingMoneyPathGuard, stagingMoneyPathBaseUrl } from './testEnv'
import { E2E_IDENTITIES } from './e2e-test-identities'

async function main() {
  assertStagingMoneyPathGuard()
  const base = stagingMoneyPathBaseUrl()
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ baseURL: base })
  const page = await ctx.newPage()
  await page.goto('/login')
  await page.locator('input[id="email"]').fill(E2E_IDENTITIES.consumer.email)
  await page.locator('input[id="password"]').fill(E2E_IDENTITIES.consumer.password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60_000 })
  const res = await ctx.request.post('/api/stripe/checkout', {
    data: { sku: 'plan_and_export', returnTo: '/print' },
  })
  const { url } = await res.json()
  await page.goto(url!)
  await page.waitForTimeout(3000)
  const enterManual = page.getByRole('button', { name: /enter address manually/i })
  if (await enterManual.isVisible().catch(() => false)) {
    await enterManual.click()
    await page.waitForTimeout(2000)
  }
  const iframes = await page.locator('iframe').evaluateAll((els) =>
    els.map((e) => ({
      name: e.getAttribute('name'),
      title: e.getAttribute('title'),
      src: e.getAttribute('src')?.slice(0, 80),
    })),
  )
  console.log('iframes', JSON.stringify(iframes, null, 2))
  const buttons = await page.getByRole('button').allTextContents()
  console.log('buttons', buttons)
  const text = await page.locator('body').innerText()
  console.log('body text (first 3000 chars):', text.slice(0, 3000))
  await page.screenshot({ path: '/tmp/stripe-checkout-debug.png', fullPage: true })
  console.log('screenshot: /tmp/stripe-checkout-debug.png')
  // Try clicking Card payment method if present
  const cardOption = page.getByRole('button', { name: /^card$/i }).or(page.getByText(/^Card$/i).first())
  if (await cardOption.isVisible().catch(() => false)) {
    await cardOption.click()
    await page.waitForTimeout(2000)
    const iframes2 = await page.locator('iframe').evaluateAll((els) =>
      els.map((e) => ({
        name: e.getAttribute('name'),
        title: e.getAttribute('title'),
      })),
    )
    console.log('iframes after Card click', JSON.stringify(iframes2, null, 2))
  }
  await browser.close()
}

main().catch(console.error)
