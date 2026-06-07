import { expect, type Page } from '@playwright/test'

/** Navigate from /advisor to the linked E2E advisor client. */
export async function gotoAdvisorLinkedClient(page: Page) {
  await page.goto('/advisor')
  await page.getByText('My Clients').first().waitFor({ state: 'visible', timeout: 30_000 })
  const namedRow = page
    .locator('tbody tr')
    .filter({ hasText: /E2E Advisor Client|Morgan Demo|Advisor Client/i })
    .first()
  const targetRow =
    (await namedRow.count()) > 0
      ? namedRow
      : page.locator('tbody tr').filter({ has: page.getByRole('link', { name: 'View →' }) }).first()
  await targetRow.getByRole('link', { name: 'View →' }).click()
  await page.waitForURL(/\/advisor\/clients\/[a-f0-9-]+$/)
}

/** Click an advisor client tab and wait until it becomes active. */
export async function clickAdvisorClientTab(page: Page, tabLabel: RegExp) {
  const tab = page.locator('div.flex.gap-1.-mb-px').getByRole('button', { name: tabLabel })
  await tab.click()
  await expect(tab).toHaveClass(/text-\[color:var\(--mwm-navy\)\]/, { timeout: 30_000 })
}

/** @deprecated Use gotoAdvisorLinkedClient */
export const gotoMichaelJohnsonClient = gotoAdvisorLinkedClient
