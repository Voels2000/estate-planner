import { test, expect } from '@playwright/test'

function uniquePresetName(suffix: string) {
  return `Playwright Preset ${suffix} ${Date.now()}`
}

test.describe('Advisor preset APIs', () => {
  test('GET /api/advisor/presets returns array', async ({ request }) => {
    const res = await request.get('/api/advisor/presets')
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.presets)).toBe(true)
  })

  test('POST creates preset with is_preset true', async ({ request }) => {
    const scenarioName = uniquePresetName('POST')
    const res = await request.post('/api/advisor/presets', {
      data: {
        scenario_name: scenarioName,
        returnMeanPct: 5.5,
        inflationRatePct: 3.2,
        volatilityPct: 12,
        simulationCount: 1000,
      },
    })
    expect(res.status(), await res.text()).toBe(201)
    const body = await res.json()
    expect(body.preset.scenario_name).toBe(scenarioName)
    expect(body.preset.is_preset).toBe(true)
    await request.delete(`/api/advisor/presets/${body.preset.id}`)
  })

  test('PATCH updates preset name', async ({ request }) => {
    const scenarioName = uniquePresetName('PATCH')
    const createRes = await request.post('/api/advisor/presets', {
      data: {
        scenario_name: scenarioName,
        returnMeanPct: 5.5,
      },
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = (await createRes.json()).preset

    const updatedName = `${scenarioName} Updated`
    const res = await request.patch(`/api/advisor/presets/${created.id}`, {
      data: { scenario_name: updatedName },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect((await res.json()).preset.scenario_name).toBe(updatedName)

    await request.delete(`/api/advisor/presets/${created.id}`)
  })

  test('PATCH default clears previous default', async ({ request }) => {
    const firstName = uniquePresetName('DefaultA')
    const secondName = uniquePresetName('DefaultB')

    const firstRes = await request.post('/api/advisor/presets', {
      data: { scenario_name: firstName, returnMeanPct: 5, is_default: true },
    })
    expect(firstRes.status(), await firstRes.text()).toBe(201)
    const first = (await firstRes.json()).preset

    const secondRes = await request.post('/api/advisor/presets', {
      data: { scenario_name: secondName, returnMeanPct: 6 },
    })
    expect(secondRes.status(), await secondRes.text()).toBe(201)
    const second = (await secondRes.json()).preset

    const setRes = await request.patch(`/api/advisor/presets/${second.id}/default`)
    expect(setRes.ok(), await setRes.text()).toBeTruthy()

    const after = await request.get('/api/advisor/presets')
    const rows = (await after.json()).presets as Array<{ id: string; is_default: boolean }>
    const defaults = rows.filter((r) => r.is_default)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe(second.id)

    await request.delete(`/api/advisor/presets/${first.id}`)
    await request.delete(`/api/advisor/presets/${second.id}`)
  })

  test('DELETE removes preset', async ({ request }) => {
    const scenarioName = uniquePresetName('DELETE')
    const createRes = await request.post('/api/advisor/presets', {
      data: { scenario_name: scenarioName, returnMeanPct: 4 },
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = (await createRes.json()).preset

    const res = await request.delete(`/api/advisor/presets/${created.id}`)
    expect(res.ok(), await res.text()).toBeTruthy()

    const list = await request.get('/api/advisor/presets')
    const presets = (await list.json()).presets as Array<{ id: string }>
    expect(presets.some((p) => p.id === created.id)).toBe(false)
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
    const name = uniquePresetName('UI')
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
    const created = (await create.json()).preset

    try {
      await page.goto('/advisor')
      await page.getByText('My Clients').first().waitFor({ state: 'visible', timeout: 30_000 })
      const row = page
        .locator('tbody tr')
        .filter({ has: page.getByRole('link', { name: 'View →' }) })
        .first()
      await row.getByRole('link', { name: 'View →' }).click()
      await page.waitForURL(/\/advisor\/clients\/[a-f0-9-]+$/)
      await page.getByRole('button', { name: /Strategy/ }).click()
      await page.waitForURL(/[?&]tab=strategy/, { timeout: 30_000 })

      const assumptionsSection = page.locator('section').filter({
        hasText: 'Monte Carlo — Assumption Overrides',
      })
      await assumptionsSection.getByRole('button', { name: /Expand/ }).click()

      await expect(assumptionsSection.getByText('Load preset')).toBeVisible({
        timeout: 30_000,
      })
      await assumptionsSection.locator('select').selectOption({ label: name })
      await assumptionsSection.getByRole('button', { name: 'Load' }).click()

      const returnInput = assumptionsSection
        .getByText('Expected Annual Return', { exact: true })
        .locator('..')
        .locator('input[type="number"]')
      await expect(returnInput).toHaveValue('7.25')
    } finally {
      await request.delete(`/api/advisor/presets/${created.id}`)
    }
  })
})
