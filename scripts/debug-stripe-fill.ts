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
    await page.waitForTimeout(500)
  }

  await page.getByLabel(/^Country$/i).selectOption('US').catch(() => {})
  await page.getByRole('textbox', { name: /address line 1/i }).fill('123 Test Street').catch(() => {})
  await page.getByRole('textbox', { name: /^City$/i }).fill('Seattle').catch(() => {})
  await page.getByRole('textbox', { name: /ZIP|postal code/i }).fill('98101').catch(() => {})
  await page.getByLabel(/^State$/i).selectOption('WA').catch(() => {})

  const locators = [
    ['page placeholder card', page.getByPlaceholder('1234 1234 1234 1234')],
    ['origin frame card', page.frameLocator('iframe[name="stripe-origin-frame"]').getByPlaceholder('1234 1234 1234 1234')],
    ['any frame card', page.frameLocator('iframe').first().getByPlaceholder('1234 1234 1234 1234')],
  ] as const

  for (const [label, loc] of locators) {
    try {
      await loc.waitFor({ state: 'visible', timeout: 3000 })
      await loc.fill('4242424242424242')
      console.log(`OK filled card via ${label}`)
      break
    } catch (e) {
      console.log(`FAIL ${label}:`, (e as Error).message.split('\n')[0])
    }
  }

  for (const [label, loc] of [
    ['page expiry', page.getByPlaceholder('MM / YY')],
    ['origin expiry', page.frameLocator('iframe[name="stripe-origin-frame"]').getByPlaceholder('MM / YY')],
  ] as const) {
    try {
      await loc.fill('12 / 34')
      console.log(`OK filled expiry via ${label}`)
      break
    } catch {
      console.log(`FAIL ${label}`)
    }
  }

  for (const [label, loc] of [
    ['page cvc', page.getByPlaceholder('CVC')],
    ['origin cvc', page.frameLocator('iframe[name="stripe-origin-frame"]').getByPlaceholder('CVC')],
  ] as const) {
    try {
      await loc.fill('123')
      console.log(`OK filled cvc via ${label}`)
      break
    } catch {
      console.log(`FAIL ${label}`)
    }
  }

  await page.getByPlaceholder(/full name on card/i).fill('E2E Consumer').catch(() => {})

  const saveInfo = page.getByRole('checkbox', { name: /save my information/i })
  if (await saveInfo.isChecked().catch(() => false)) {
    await saveInfo.uncheck()
    console.log('unchecked save info')
  }

  const pay = page.getByRole('button', { name: /^Pay$/i })
  console.log('Pay enabled:', await pay.isEnabled())
  await pay.click()
  await page.waitForTimeout(8000)
  console.log('URL after pay:', page.url())
  const errors = await page.locator('[role="alert"], .FieldError, .Error').allTextContents().catch(() => [])
  console.log('errors:', errors)
  await page.screenshot({ path: '/tmp/stripe-after-pay.png', fullPage: true })
  await browser.close()
}

main().catch(console.error)
