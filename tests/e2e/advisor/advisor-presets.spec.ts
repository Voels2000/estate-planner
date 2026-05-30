import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'
import { clickAdvisorClientTab, gotoMichaelJohnsonClient } from '../helpers/constants'

const API_TIMEOUT_MS = 30_000

function uniquePresetName(suffix: string) {
  return `Playwright Preset ${suffix} ${Date.now()}`
}

function apiOptions() {
  return { timeout: API_TIMEOUT_MS }
}

test.describe('Advisor preset APIs', () => {
  test.describe.configure({ timeout: 120_000 })

  test('GET /api/advisor/presets returns array', async ({ request }) => {
    const res = await request.get('/api/advisor/presets', apiOptions())
    expect(res.ok(), await res.text()).toBeTruthy()
    const body = await res.json()
    expect(Array.isArray(body.presets)).toBe(true)
  })

  test('POST creates preset with is_preset true', async ({ request }) => {
    const scenarioName = uniquePresetName('POST')
    const res = await request.post('/api/advisor/presets', {
      ...apiOptions(),
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
    await request.delete(`/api/advisor/presets/${body.preset.id}`, apiOptions())
  })

  test('PATCH updates preset name', async ({ request }) => {
    const scenarioName = uniquePresetName('PATCH')
    const createRes = await request.post('/api/advisor/presets', {
      ...apiOptions(),
      data: {
        scenario_name: scenarioName,
        returnMeanPct: 5.5,
      },
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = (await createRes.json()).preset

    const updatedName = `${scenarioName} Updated`
    const res = await request.patch(`/api/advisor/presets/${created.id}`, {
      ...apiOptions(),
      data: { scenario_name: updatedName },
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    expect((await res.json()).preset.scenario_name).toBe(updatedName)

    await request.delete(`/api/advisor/presets/${created.id}`, apiOptions())
  })

  test('PATCH default clears previous default', async ({ request }) => {
    const firstName = uniquePresetName('DefaultA')
    const secondName = uniquePresetName('DefaultB')

    const firstRes = await request.post('/api/advisor/presets', {
      ...apiOptions(),
      data: { scenario_name: firstName, returnMeanPct: 5, is_default: true },
    })
    expect(firstRes.status(), await firstRes.text()).toBe(201)
    const first = (await firstRes.json()).preset

    const secondRes = await request.post('/api/advisor/presets', {
      ...apiOptions(),
      data: { scenario_name: secondName, returnMeanPct: 6 },
    })
    expect(secondRes.status(), await secondRes.text()).toBe(201)
    const second = (await secondRes.json()).preset

    const setRes = await request.patch(`/api/advisor/presets/${second.id}/default`, apiOptions())
    expect(setRes.ok(), await setRes.text()).toBeTruthy()

    const after = await request.get('/api/advisor/presets', apiOptions())
    const rows = (await after.json()).presets as Array<{ id: string; is_default: boolean }>
    const defaults = rows.filter((r) => r.is_default)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe(second.id)

    await request.delete(`/api/advisor/presets/${first.id}`, apiOptions())
    await request.delete(`/api/advisor/presets/${second.id}`, apiOptions())
  })

  test('DELETE removes preset', async ({ request }) => {
    const scenarioName = uniquePresetName('DELETE')
    const createRes = await request.post('/api/advisor/presets', {
      ...apiOptions(),
      data: { scenario_name: scenarioName, returnMeanPct: 4 },
    })
    expect(createRes.status(), await createRes.text()).toBe(201)
    const created = (await createRes.json()).preset

    const res = await request.delete(`/api/advisor/presets/${created.id}`, apiOptions())
    expect(res.ok(), await res.text()).toBeTruthy()

    const list = await request.get('/api/advisor/presets', apiOptions())
    const presets = (await list.json()).presets as Array<{ id: string }>
    expect(presets.some((p) => p.id === created.id)).toBe(false)
  })
})

test.describe('Advisor preset APIs — consumer forbidden', () => {
  test.skip(
    !existsSync('.auth/consumer.json'),
    'Run consumer-setup first (npm run test:e2e:consumer -- --project=consumer-setup)',
  )
  test.use({ storageState: '.auth/consumer.json' })

  test('GET presets returns 403 for consumer', async ({ request }) => {
    const res = await request.get('/api/advisor/presets', apiOptions())
    expect(res.status()).toBe(403)
  })
})

test.describe('Load preset in recommendation form', () => {
  // UI copy (Strategy tab → Monte Carlo — Assumption Overrides, expanded):
  //   label "Load preset" (lowercase p), button "Load", not "Load Preset"
  const presetIdsToCleanup: string[] = []

  test.beforeEach(async ({ request }) => {
    const res = await request.post('/api/advisor/presets', {
      ...apiOptions(),
      data: { scenario_name: `E2E UI seed ${Date.now()}`, returnMeanPct: 6 },
    })
    if (res.ok()) {
      presetIdsToCleanup.push((await res.json()).preset.id)
    }
  })

  test.afterEach(async ({ request }) => {
    while (presetIdsToCleanup.length > 0) {
      const id = presetIdsToCleanup.pop()
      if (id) await request.delete(`/api/advisor/presets/${id}`, apiOptions())
    }
  })

  test('preset dropdown pre-fills Monte Carlo fields', async ({ page, request }) => {
    const name = uniquePresetName('UI')
    const create = await request.post('/api/advisor/presets', {
      ...apiOptions(),
      data: {
        scenario_name: name,
        returnMeanPct: 7.25,
        inflationRatePct: 2.75,
        volatilityPct: 14,
        simulationCount: 2000,
      },
    })
    expect(create.status(), await create.text()).toBe(201)
    const created = (await create.json()).preset
    presetIdsToCleanup.push(created.id)

    await gotoMichaelJohnsonClient(page)
    await clickAdvisorClientTab(page, /Strategy/)

    const assumptionsSection = page.locator('section').filter({
      hasText: 'Monte Carlo — Assumption Overrides',
    })
    await assumptionsSection.getByRole('button', { name: /Expand/ }).click()

    // Block only renders when presets.length > 0 after GET /api/advisor/presets
    await expect(assumptionsSection.getByText('Load preset', { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(assumptionsSection.locator('select option', { hasText: name })).toHaveCount(1, {
      timeout: 30_000,
    })

    await assumptionsSection.locator('select').selectOption({ label: name })
    await assumptionsSection.getByRole('button', { name: 'Load', exact: true }).click()

    const returnInput = assumptionsSection
      .getByText('Expected Annual Return', { exact: true })
      .locator('..')
      .locator('input[type="number"]')
    await expect(returnInput).toHaveValue('7.25')
  })
})
