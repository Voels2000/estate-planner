import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'

test.describe('PR 4 projections content split', () => {
  test('projections page is deterministic-only — no estate MC loader', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/(dashboard)/projections/page.tsx'),
      'utf8',
    )
    expect(src).not.toContain('loadScenarioMonteCarloWithStaleness')
    expect(src).not.toContain('state_estate_tax_rules')
    expect(src).not.toContain('EstateOutlook')
  })

  test('monte-carlo page loads precomputed estate outlook bands', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/(dashboard)/monte-carlo/page.tsx'),
      'utf8',
    )
    expect(src).toContain('loadScenarioMonteCarloWithStaleness')
    expect(src).toContain('estateOutlookBands')
  })

  test('projections client does not render estate outlook section', () => {
    const src = readFileSync(
      join(process.cwd(), 'app/(dashboard)/projections/_projections-client.tsx'),
      'utf8',
    )
    expect(src).not.toContain('EstateOutlook')
    expect(src).not.toContain('mcBands')
  })
})
