import { test, expect } from '@playwright/test'

/**
 * Advisor strategy recommendation end-to-end verification.
 * Covers: SLAT, ILIT, liquidity, roth — the sources added in Session 101.
 *
 * Uses e2e-advisor@mywealthmaps.test linked client household when seeded.
 * to PLAYWRIGHT_ADVISOR_EMAIL (canonical: e2e-advisor@mywealthmaps.test). Cleans up after each test.
 */

const CLIENT_HOUSEHOLD_ID =
  process.env.PLAYWRIGHT_ADVISOR_CLIENT_HOUSEHOLD_ID ?? '90cc8759-5465-4671-8894-e17eca783a42'

const SOURCES = [
  { strategySource: 'slat',      amount: 500000, category: 'trust_exclusion', label: 'SLAT' },
  { strategySource: 'ilit',      amount: 250000, category: 'trust_exclusion', label: 'ILIT' },
  { strategySource: 'liquidity', amount: 100000, category: 'liability',       label: 'Liquidity' },
  { strategySource: 'roth',      amount: 75000,  category: 'trust_exclusion', label: 'Roth' },
]

for (const src of SOURCES) {
  test(`Advisor can recommend ${src.label} and delete it`, async ({ request }) => {
    const scenarioName = `Playwright ${src.label} Verify`

    // POST — create recommendation
    const postRes = await request.post('/api/advisor/strategy-recommendation', {
      data: {
        householdId: CLIENT_HOUSEHOLD_ID,
        strategySource: src.strategySource,
        amount: src.amount,
        sign: -1,
        confidenceLevel: 'medium',
        scenarioName,
        effectiveYear: 2026,
        category: src.category,
        metric_target: 'taxable_estate',
      },
    })
    expect(postRes.ok(), `POST ${src.label} failed: ${await postRes.text()}`).toBeTruthy()
    const postBody = await postRes.json()
    expect(postBody.lineItem).toBeTruthy()
    expect(postBody.lineItem.strategy_source).toBe(src.strategySource)
    expect(postBody.lineItem.source_role).toBe('advisor')
    expect(postBody.lineItem.is_active).toBe(true)
    expect(postBody.lineItem.category).toBe(src.category)

    // DELETE — clean up
    const deleteRes = await request.delete('/api/advisor/strategy-recommendation', {
      data: {
        householdId: CLIENT_HOUSEHOLD_ID,
        strategySource: src.strategySource,
        scenarioName,
      },
    })
    expect(deleteRes.ok(), `DELETE ${src.label} failed: ${await deleteRes.text()}`).toBeTruthy()
    expect((await deleteRes.json()).success).toBe(true)
  })
}
