import { test, expect } from '@playwright/test'
import {
  MOBILE_VIEWPORT,
  assertDrawerClosed,
  assertHasHorizontalScrollWrapper,
  assertNoHorizontalOverflow,
  openMobileNavDrawer,
  waitForDashboard,
} from '../helpers/mobile-review'

test.use({ viewport: MOBILE_VIEWPORT })

test.describe('Mobile review mode (LAUNCH_CHECKLIST Track 2)', () => {
  test('step 14 — dashboard renders without horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForDashboard(page)
    await assertNoHorizontalOverflow(page)
  })

  test('step 13 — mobile alert banner when open alerts or pending recommendations exist', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await waitForDashboard(page)

    const mobileBanner = page.locator('div.lg\\:hidden.bg-amber-50').first()
    const hasPriorityAlert = await page
      .getByText(/Focus here first|Staying current/)
      .first()
      .isVisible()
      .catch(() => false)
    const pendingRecHeading = page.getByRole('heading', { name: 'Advisor Recommendations' })
    const hasPendingRecPanel = await pendingRecHeading.isVisible().catch(() => false)
    const hasPendingBadge =
      hasPendingRecPanel &&
      (await page.locator('span').filter({ hasText: /^\d+ pending$/ }).first().isVisible().catch(() => false))

    if (hasPriorityAlert || hasPendingBadge) {
      await expect(mobileBanner).toBeVisible()
      await expect(mobileBanner).toContainText(/open alert|advisor recommendation/i)
      await expect(mobileBanner).toContainText(/Tap to review/)
    } else {
      await expect(mobileBanner).toHaveCount(0)
    }
  })

  test('step 15 — projections table scrolls horizontally when data exists', async ({ page }) => {
    await page.goto('/projections')
    await expect(page.getByText(/projection/i).first()).toBeVisible({ timeout: 30_000 })

    const missingData = page.getByText(/No projection data yet|Complete your profile first/)
    if (await missingData.isVisible().catch(() => false)) {
      await assertNoHorizontalOverflow(page)
      test.skip(true, 'E2E household has no projection rows')
    }

    await page.getByRole('button', { name: 'table' }).click()
    await assertHasHorizontalScrollWrapper(page)
    await assertNoHorizontalOverflow(page)
  })

  test('step 16 — RMD table scrolls horizontally when eligible accounts exist', async ({ page }) => {
    await page.goto('/rmd')
    await expect(page.getByRole('heading', { name: 'RMD Calculator' })).toBeVisible({
      timeout: 30_000,
    })

    if (await page.getByText('No RMD-eligible accounts found').isVisible().catch(() => false)) {
      await assertNoHorizontalOverflow(page)
      test.skip(true, 'E2E household has no RMD-eligible accounts')
    }

    await assertHasHorizontalScrollWrapper(page)
    await assertNoHorizontalOverflow(page)
  })

  test('step 17 — scenarios page uses horizontal scroll wrapper', async ({ page }) => {
    await page.goto('/scenarios')
    await expect(page.getByRole('heading', { name: 'Scenarios' })).toBeVisible({
      timeout: 30_000,
    })
    await assertHasHorizontalScrollWrapper(page)
    await assertNoHorizontalOverflow(page)
  })

  test('step 18 — advisor recommendation Accept/Decline buttons stack full-width', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await waitForDashboard(page)

    const accept = page.getByRole('button', { name: 'Accept' }).first()
    const hasPending = await accept.isVisible({ timeout: 8_000 }).catch(() => false)
    test.skip(!hasPending, 'No pending advisor recommendations on E2E consumer household')

    const decline = page.getByRole('button', { name: 'Decline' }).first()
    const acceptBox = await accept.boundingBox()
    const declineBox = await decline.boundingBox()
    const viewport = page.viewportSize()
    expect(acceptBox).not.toBeNull()
    expect(declineBox).not.toBeNull()
    expect(viewport).not.toBeNull()

    expect(acceptBox!.width).toBeGreaterThanOrEqual(viewport!.width * 0.85)
    expect(declineBox!.width).toBeGreaterThanOrEqual(viewport!.width * 0.85)
    expect(declineBox!.y).toBeGreaterThan(acceptBox!.y)
  })

  test('step 19 — hamburger menu navigates and closes drawer', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForDashboard(page)
    await assertDrawerClosed(page)

    await openMobileNavDrawer(page)
    await page.locator('#dashboard-sidebar').getByRole('link', { name: 'Profile' }).click()

    await expect(page).toHaveURL(/\/profile/)
    await assertDrawerClosed(page)
  })
})
