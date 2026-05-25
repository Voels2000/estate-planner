import { test, expect } from '@playwright/test'
import { queryReferralClickLatest } from '../helpers/supabase-fixture'

test.describe('Referral tracking API (acquisition §A–B)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('event page with advisor ref loads', async ({ page }) => {
    const ref = process.env.PLAYWRIGHT_ADVISOR_REFERRAL_CODE
    test.skip(!ref, 'Set PLAYWRIGHT_ADVISOR_REFERRAL_CODE from advisor_directory')

    const res = await page.goto(`/event/selling-a-business?ref=${ref}`)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('h1').first()).toBeVisible()
  })

  test('POST /api/referral/track logs advisor click', async ({ request }) => {
    const ref = process.env.PLAYWRIGHT_ADVISOR_REFERRAL_CODE
    test.skip(!ref, 'Set PLAYWRIGHT_ADVISOR_REFERRAL_CODE')

    const before = await queryReferralClickLatest(ref!, 'advisor')

    const res = await request.post('/api/referral/track', {
      data: {
        ref,
        event_slug: 'selling-a-business',
        source_url: '/event/selling-a-business',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const after = await queryReferralClickLatest(ref!, 'advisor')
      expect(after?.id).toBeTruthy()
      if (before?.id && after?.id) {
        expect(after.id).not.toBe(before.id)
      }
    }
  })

  test('POST /api/referral/track logs attorney click', async ({ request }) => {
    const ref = process.env.PLAYWRIGHT_ATTORNEY_REFERRAL_CODE ?? 'e2eatt01'

    const res = await request.post('/api/referral/track', {
      data: {
        ref,
        type: 'attorney',
        event_slug: 'selling-a-business',
        source_url: '/event/selling-a-business',
      },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
