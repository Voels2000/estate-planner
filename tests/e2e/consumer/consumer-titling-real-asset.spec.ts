import { test, expect } from '@playwright/test'

test.describe('Consumer titling with real asset (smoke §6)', () => {
  let assetId: string | null = null

  test.afterEach(async ({ request }) => {
    if (!assetId) return
    await request.delete('/api/consumer/assets', { data: { id: assetId } })
    assetId = null
  })

  test('POST entity-titling for created asset returns 200', async ({ request }) => {
    const createRes = await request.post('/api/consumer/assets', {
      data: {
        type: 'financial_account',
        name: `Playwright Titling Asset ${Date.now()}`,
        value: 25000,
        owner: 'person1',
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()
    const created = await createRes.json()
    assetId = created.id

    const titlingRes = await request.post('/api/consumer/entity-titling', {
      data: {
        asset_id: assetId,
        titling_row_id: null,
        title_type: 'sole',
        notes: 'Playwright titling smoke',
        titling: 'individual_p1',
        liquidity: 'liquid',
        cost_basis: null,
        basis_date: null,
      },
    })
    expect(titlingRes.status(), await titlingRes.text()).toBe(200)
  })

  test('/titling page loads', async ({ page }) => {
    await page.goto('/titling')
    await expect(page.getByRole('heading', { name: /titling|beneficiar/i }).first()).toBeVisible({
      timeout: 20_000,
    })
  })
})
