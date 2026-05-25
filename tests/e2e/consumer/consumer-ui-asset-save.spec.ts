import { test, expect } from '@playwright/test'

const ASSET_NAME = 'Playwright Smoke CD'

test.describe('Consumer UI asset save (smoke §2 UI)', () => {
  test('add asset from /assets UI and see row in list', async ({ page }) => {
    await page.goto('/assets')
    await expect(page.getByRole('heading', { name: /asset/i }).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.getByRole('button', { name: '+ Add Asset' }).click()
    await expect(page.getByRole('heading', { name: 'Add Asset' })).toBeVisible()

    const uniqueName = `${ASSET_NAME} ${Date.now()}`
    await page.locator('input').filter({ hasNot: page.locator('[type="hidden"]') }).nth(0).fill(uniqueName)

    const valueInputs = page.locator('input[type="number"], input[inputmode="decimal"]')
    if ((await valueInputs.count()) > 0) {
      await valueInputs.first().fill('10000')
    } else {
      await page.getByLabel(/value/i).fill('10000')
    }

    await page.getByRole('button', { name: 'Add Asset', exact: true }).click()
    await expect(page.getByText(uniqueName).first()).toBeVisible({ timeout: 20_000 })

    const row = page.locator('tr, [class*="border"]').filter({ hasText: uniqueName }).first()
    const deleteBtn = row.getByRole('button', { name: /delete|remove/i })
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click()
      const confirm = page.getByRole('button', { name: /confirm|delete/i })
      if (await confirm.isVisible().catch(() => false)) {
        await confirm.click()
      }
    }
  })
})
