import { test, expect } from '@playwright/test'

const API = '/api/consumer/household-people'

test.describe('Consumer My Family API (smoke §5)', () => {
  let personId: string | null = null

  test.afterEach(async ({ request }) => {
    if (!personId) return
    await request.delete(API, { data: { id: personId } })
    personId = null
  })

  test('POST PATCH DELETE household person', async ({ request }) => {
    const stamp = Date.now()
    const createRes = await request.post(API, {
      data: {
        full_name: `Playwright Family ${stamp}`,
        relationship: 'child',
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()
    const created = await createRes.json()
    personId = created.id
    expect(created.full_name).toContain('Playwright Family')

    const patchRes = await request.patch(API, {
      data: {
        id: personId,
        full_name: `Playwright Family Updated ${stamp}`,
        relationship: 'child',
      },
    })
    expect(patchRes.ok(), await patchRes.text()).toBeTruthy()
    const updated = await patchRes.json()
    expect(updated.full_name).toContain('Updated')

    const deleteRes = await request.delete(API, { data: { id: personId } })
    expect(deleteRes.ok(), await deleteRes.text()).toBeTruthy()
    personId = null
  })

  test('/my-family page loads', async ({ page }) => {
    await page.goto('/my-family')
    await expect(page.getByRole('heading', { name: /family/i }).first()).toBeVisible({
      timeout: 20_000,
    })
  })
})
