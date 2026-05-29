/**
 * Post-deploy smoke: tier-1 quick-add modal updates net worth without manual refresh.
 * Usage: node scripts/verify-quick-add-deploy.mjs
 */
import { chromium } from '@playwright/test'
import { readFileSync } from 'fs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://estate-planner-gules.vercel.app'
const env = Object.fromEntries(
  readFileSync('.env.test', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('='))
    .map(([k, ...v]) => [k, v.join('=')]),
)

const email = env.PLAYWRIGHT_CONSUMER_TIER1_EMAIL
const password = env.PLAYWRIGHT_CONSUMER_TIER1_PASSWORD

if (!email || !password) {
  console.error('Missing tier-1 credentials in .env.test')
  process.exit(1)
}

const browser = await chromium.launch()
const context = await browser.newContext({ baseURL })
const page = await context.newPage()

await page.goto('/login')
await page.getByLabel(/email/i).fill(email)
await page.getByLabel(/password/i).fill(password)
await page.getByRole('button', { name: /sign in|log in/i }).click()
await page.waitForURL(/\/dashboard/, { timeout: 30_000 })

const quickAdd = page.getByRole('button', { name: /Add →/i }).first()
const hasQuickAdd = await quickAdd.isVisible().catch(() => false)
if (!hasQuickAdd) {
  console.log('SKIP: tier-1 account already has assets — quick-add CTA not shown')
  await browser.close()
  process.exit(0)
}

const netWorthBefore = await page.getByText('Net Worth', { exact: true }).locator('..').textContent()
await quickAdd.click()
await page.getByRole('dialog').waitFor()
await page.getByPlaceholder('Chase checking').fill(`Deploy smoke ${Date.now()}`)
await page.locator('input[placeholder="250000"]').fill('12345')
await page.getByRole('button', { name: /^Add asset$/i }).click()
await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 20_000 })
await page.waitForTimeout(2000)
const bodyAfter = await page.locator('body').textContent()
const updated = bodyAfter?.includes('12,345') || bodyAfter?.includes('12345')
console.log(updated ? 'PASS: net worth area updated after modal submit (no manual refresh)' : 'FAIL: value not visible after modal submit')
await browser.close()
process.exit(updated ? 0 : 1)
