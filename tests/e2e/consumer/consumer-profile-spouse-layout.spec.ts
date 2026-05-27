import { test, expect } from '@playwright/test'

/**
 * Profile spouse layout (post 2026-05-27 redesign) — live column headers, spouse toggle,
 * section labels. Save path unchanged; does not submit the form unless noted.
 */
test.describe('Consumer profile spouse layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/profile')
    await expect(page.getByRole('heading', { level: 1, name: 'Your Profile' })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('shows Household and Household Planning section headers', async ({ page }) => {
    await expect(page.getByText('Household', { exact: true })).toBeVisible()
    await expect(page.getByText('Household Planning', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: /Scenarios →/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /Asset Allocation →/ })).toBeVisible()
  })

  test('person column header updates live from Your Name', async ({ page }) => {
    const nameInput = page.getByRole('textbox', { name: 'Jane', exact: true })
    await expect(nameInput).toBeVisible()
    const prior = await nameInput.inputValue()
    const liveName = `Playwright Live ${Date.now()}`.slice(0, 40)

    await nameInput.fill(liveName)
    const personPanel = page.locator('div.rounded-xl').filter({ has: nameInput })
    await expect(personPanel.getByText(liveName, { exact: true })).toBeVisible()

    await nameInput.fill(prior)
    const fallback = prior.trim() || 'You'
    await expect(personPanel.getByText(fallback, { exact: true })).toBeVisible()
  })

  test('spouse toggle reveals second column and live spouse header', async ({ page }) => {
    const spouseCheckbox = page.getByRole('checkbox', { name: /include spouse/i })
    const wasChecked = await spouseCheckbox.isChecked()

    const spouseNameInput = page.getByRole('textbox', { name: 'John', exact: true })
    const priorSpouseName = wasChecked ? await spouseNameInput.inputValue() : ''

    try {
      if (!wasChecked) {
        await spouseCheckbox.check()
      }
      await expect(spouseNameInput).toBeVisible()

      const liveSpouse = `Spouse E2E ${Date.now()}`.slice(0, 40)
      await spouseNameInput.fill(liveSpouse)
      const spousePanel = page.locator('div.rounded-xl').filter({ has: spouseNameInput })
      await expect(spousePanel.getByText(liveSpouse, { exact: true })).toBeVisible()

      await spouseNameInput.fill(priorSpouseName)
    } finally {
      if (!wasChecked) {
        await spouseCheckbox.uncheck()
        await expect(spouseNameInput).toBeHidden()
      }
    }
  })

  test('spouse columns use side-by-side grid on sm+ viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const spouseCheckbox = page.getByRole('checkbox', { name: /include spouse/i })
    const wasChecked = await spouseCheckbox.isChecked()

    try {
      if (!wasChecked) await spouseCheckbox.check()
      const personNameInput = page.getByRole('textbox', { name: 'Jane', exact: true })
      const peopleGrid = page.locator('div.grid').filter({ has: personNameInput }).first()
      await expect(peopleGrid).toHaveClass(/sm:grid-cols-2/)
      await expect(page.getByRole('textbox', { name: 'John', exact: true })).toBeVisible()
    } finally {
      if (!wasChecked) await spouseCheckbox.uncheck()
    }
  })
})
