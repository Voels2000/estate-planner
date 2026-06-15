import { test, expect } from '@playwright/test'
import { currentFederalExemption } from '@/lib/export/narrativeEngine'
import { findUserIdByEmail, initSupabaseEnv } from '../../../scripts/seed-e2e-lib'
import { E2E_IDENTITIES } from '../../../scripts/e2e-test-identities'

/** Matches `fmt()` in narrativeEngine / generatePDFReport — not full locale dollars. */
function fmtPdfDollars(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n).toLocaleString()}`
}

/**
 * B4 PDF narrative — slow/data-heavy; runs in release:preflight deep suite, not PR gate.
 */
test.describe('B4 PDF narrative content', () => {
  test('meeting-prep narrative PDF includes MFJ exemption, executive summary, gifting bar', async ({
    request,
  }) => {
    initSupabaseEnv()
    const clientUserId = await findUserIdByEmail(E2E_IDENTITIES.advisorClient.email)
    test.skip(!clientUserId, 'Run npm run seed:e2e — advisor client missing')

    const narrativeRes = await request.get(
      `/api/advisor/meeting-prep-pdf/${clientUserId}?type=report`,
    )
    expect(narrativeRes.ok(), await narrativeRes.text()).toBeTruthy()
    const html = await narrativeRes.text()

    expect(html).toContain('Federal & State Tax Analysis')
    expect(html).toMatch(/executive|summary|estate/i)

    const mfjExemption = currentFederalExemption('mfj')
    expect(html).toContain(fmtPdfDollars(mfjExemption))
    expect(html).not.toContain('$13,990,000')
    expect(html).not.toContain('$15,000,000')

    expect(html).toMatch(/gifting-bar|Gifting capacity/i)

    const briefRes = await request.get(
      `/api/advisor/meeting-prep-pdf/${clientUserId}?type=brief`,
    )
    expect(briefRes.ok(), await briefRes.text()).toBeTruthy()
    const briefHtml = await briefRes.text()
    expect(briefHtml.length).toBeGreaterThan(500)
    expect(briefHtml).not.toContain('Federal & State Tax Analysis')
  })
})
