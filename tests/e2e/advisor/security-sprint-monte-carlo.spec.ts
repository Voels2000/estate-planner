/**
 * Monte Carlo edge function JWT smoke — advisor on E2E advisor client household.
 * Manual equivalent: e2e-advisor@mywealthmaps.test → linked client → Strategy → Run Monte Carlo
 */
import { test, expect } from '@playwright/test'
import { clickAdvisorClientTab, gotoAdvisorLinkedClient } from '../helpers/constants'

test.describe('Security sprint — Monte Carlo edge auth', () => {
  test('Strategy tab Monte Carlo returns P10/P50/P90', async ({ page }) => {
    const edgeResponses: number[] = []

    page.on('response', (res) => {
      if (res.url().includes('/functions/v1/estate-monte-carlo')) {
        edgeResponses.push(res.status())
      }
    })

    await gotoAdvisorLinkedClient(page)
    await clickAdvisorClientTab(page, /Strategy/)

    await page.getByRole('button', { name: 'Run Monte Carlo' }).click()

    await expect(page.getByText('P50 (Median)')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('P10 (Bear market)')).toBeVisible()
    await expect(page.getByText('P90 (Bull market)')).toBeVisible()

    expect(edgeResponses.length).toBeGreaterThan(0)
    expect(edgeResponses.every((s) => s >= 200 && s < 300)).toBe(true)
  })
})
