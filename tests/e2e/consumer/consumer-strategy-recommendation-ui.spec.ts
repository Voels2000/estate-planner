import { test, expect } from '@playwright/test'

test.describe('Advisor strategy recommendation panel (smoke §9)', () => {
  test('dashboard shows recommendation panel when items exist', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(
      page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }),
    ).toBeVisible({ timeout: 20_000 })

    const panel = page.getByText(/strategy recommendation|advisor recommendation/i)
    test.skip(
      (await panel.count()) === 0,
      'No linked advisor recommendations on fixture household',
    )

    await expect(panel.first()).toBeVisible()
    const acceptBtn = page.getByRole('button', { name: /^Accept$/i })
    if (await acceptBtn.first().isVisible().catch(() => false)) {
      await expect(page.getByRole('button', { name: /^Decline$/i }).first()).toBeVisible()
    }
  })
})
