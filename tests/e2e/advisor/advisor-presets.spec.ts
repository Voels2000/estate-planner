import { test, expect } from '@playwright/test'

const PRESET_NAME = `Playwright Preset ${Date.now()}`

test.describe('Advisor preset APIs', () => {
  test('GET /api/advisor/presets returns array', async ({ request }) => {
    const res = await request.get('/api/advisor/presets')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.presets)).toBe(true)
  })

  test('POST creates preset with is_preset true', async ({ request }) => {
    const res = await request.post('/api/advisor/presets', {
      data: {
        scenario_name: PRESET_NAME,
        returnMeanPct: 5.5,
        inflationRatePct: 3.2,
        volatilityPct: 12,
        simulationCount: 1000,
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    const body = await res.json()
    expect(body.preset.scenario_name).toBe(PRESET_NAME)
    expect(body.preset.is_preset).toBe(true)
  })

  test('PATCH updates preset name', async ({ request }) => {
    const list = await request.get('/api/advisor/presets')
    const preset = (await list.json()).presets.find(
      (p: { scenario_name: string }) => p.scenario_name === PRESET_NAME,
    )
    expect(preset).toBeTruthy()

    const updatedName = `${PRESET_NAME} Updated`
    const res = await request.patch(`/api/advisor/presets/${preset.id}`, {
      data: { scenario_name: updatedName },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect((await res.json()).preset.scenario_name).toBe(updatedName)
  })

  test('PATCH default clears previous default', async ({ request }) => {
    const listRes = await request.get('/api/advisor/presets')
    const presets = (await listRes.json()).presets as Array<{
      id: string
      scenario_name: string
      is_default: boolean
    }>
    const target = presets.find((p) => p.scenario_name.startsWith(PRESET_NAME))
    expect(target).toBeTruthy()

    const otherName = `${PRESET_NAME} Alt`
    const createRes = await request.post('/api/advisor/presets', {
      data: { scenario_name: otherName, returnMeanPct: 6 },
    })
    expect(createRes.status()).toBe(201)
    const other = (await createRes.json()).preset

    const setRes = await request.patch(`/api/advisor/presets/${other.id}/default`)
    expect(setRes.ok(), await setRes.text()).toBeTruthy()

    const after = await request.get('/api/advisor/presets')
    const rows = (await after.json()).presets as Array<{ id: string; is_default: boolean }>
    const defaults = rows.filter((r) => r.is_default)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe(other.id)
  })

  test('DELETE removes preset', async ({ request }) => {
    const list = await request.get('/api/advisor/presets')
    const presets = (await list.json()).presets as Array<{
      id: string
      scenario_name: string
    }>
    for (const row of presets.filter((p) => p.scenario_name.includes(PRESET_NAME))) {
      const res = await request.delete(`/api/advisor/presets/${row.id}`)
      expect(res.ok(), await res.text()).toBeTruthy()
    }
  })
})

test.describe('Advisor preset APIs — consumer forbidden', () => {
  test.use({ storageState: '.auth/consumer.json' })

  test('GET presets returns 403 for consumer', async ({ request }) => {
    const res = await request.get('/api/advisor/presets')
    expect(res.status()).toBe(403)
  })
})

test.describe('Load preset in recommendation form', () => {
  test('preset dropdown pre-fills Monte Carlo fields', async ({ page, request }) => {
    const name = `Playwright UI Preset ${Date.now()}`
    const create = await request.post('/api/advisor/presets', {
      data: {
        scenario_name: name,
        returnMeanPct: 7.25,
        inflationRatePct: 2.75,
        volatilityPct: 14,
        simulationCount: 2000,
      },
    })
    expect(create.status()).toBe(201)

    await page.goto('/advisor')
    await page.getByText('My Clients').first().waitFor({ state: 'visible', timeout: 30_000 })
    const row = page.locator('tbody tr').filter({ has: page.getByRole('link', { name: 'View →' }) }).first()
    await row.getByRole('link', { name: 'View →' }).click()
    await page.waitForURL(/\/advisor\/clients\/[a-f0-9-]+$/)
    await page.getByRole('button', { name: /Strategy/ }).click()

    await expect(page.getByText('Load preset')).toBeVisible({ timeout: 30_000 })
    await page.locator('select').filter({ has: page.locator(`option:has-text("${name}")`) }).selectOption({ label: name })
    await page.getByRole('button', { name: 'Load' }).click()

    const returnInput = page
      .locator('div')
      .filter({ has: page.getByText('Expected Annual Return', { exact: true }) })
      .locator('input[type="number"]')
    await expect(returnInput).toHaveValue('7.25')

    const list = await request.get('/api/advisor/presets')
    const presets = (await list.json()).presets as Array<{ id: string; scenario_name: string }>
    const created = presets.find((p) => p.scenario_name === name)
    if (created) {
      await request.delete(`/api/advisor/presets/${created.id}`)
    }
  })
})
