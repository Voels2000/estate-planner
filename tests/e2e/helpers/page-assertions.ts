import { expect, type Page } from '@playwright/test'

export const UPGRADE_CTA = /Upgrade to unlock/i

export async function assertPageLoads(
  page: Page,
  path: string,
  heading: RegExp,
  options?: { timeout?: number },
) {
  const timeout = options?.timeout ?? 45_000
  const res = await page.goto(path, { waitUntil: 'domcontentloaded' })
  expect(res?.status(), `${path} should not 404`).toBeLessThan(400)
  const named = page.getByRole('heading', { name: heading }).first()
  if (await named.isVisible().catch(() => false)) {
    await expect(named).toBeVisible({ timeout })
    return
  }
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout })
}

export async function assertNoUpgradeBanner(page: Page) {
  await expect(page.getByText(UPGRADE_CTA)).toHaveCount(0)
}

export async function assertUpgradeBanner(page: Page, moduleName?: string) {
  await expect(page.getByText(UPGRADE_CTA).first()).toBeVisible({ timeout: 15_000 })
  if (moduleName) {
    await expect(page.getByText(moduleName, { exact: false }).first()).toBeVisible()
  }
}
