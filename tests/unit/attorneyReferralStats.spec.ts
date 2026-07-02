import { test, expect } from '@playwright/test'
import { aggregateAttorneyReferralClicks } from '../../lib/attorney/attorneyReferralStats'
import {
  ATTORNEY_EVENT_REFERRAL_LABELS,
  ATTORNEY_EVENT_REFERRAL_USAGE_TIPS,
  attorneyEventReferralUsageTip,
  attorneyReferralEventSlugs,
} from '../../lib/attorney/attorneyEventReferralKit'

test.describe('attorneyReferralStats', () => {
  test('aggregates clicks by slug, category, and 30-day window', () => {
    const now = new Date()
    const recent = new Date(now)
    recent.setDate(recent.getDate() - 5)
    const old = new Date(now)
    old.setDate(old.getDate() - 40)

    const stats = aggregateAttorneyReferralClicks([
      { event_slug: 'selling-a-business', created_at: recent.toISOString() },
      { event_slug: 'selling-a-business', created_at: recent.toISOString() },
      { event_slug: 'new-child-grandchild', created_at: old.toISOString() },
    ])

    expect(stats.totalClicksAllTime).toBe(3)
    expect(stats.clicksLast30Days).toBe(2)
    expect(stats.clicksBySlug['selling-a-business']).toBe(2)
    expect(stats.mostClickedSlug).toBe('selling-a-business')
    expect(stats.newsletterBundleSlugs[0]).toBe('selling-a-business')
    expect(stats.clicksByCategory['Business & Wealth Events']).toBe(2)
  })

  test('uses editorial default bundle with no click history', () => {
    const stats = aggregateAttorneyReferralClicks([])
    expect(stats.newsletterBundleSlugs).toEqual([
      'selling-a-business',
      'new-child-grandchild',
      'estate-tax-law-change',
    ])
  })
})

test.describe('attorneyEventReferralKit', () => {
  test('every referral slug has a Share-when usage tip', () => {
    const slugs = attorneyReferralEventSlugs()
    expect(slugs).toHaveLength(24)
    for (const slug of slugs) {
      const tip = attorneyEventReferralUsageTip(slug)
      expect(tip, `missing tip for ${slug}`).toBeTruthy()
      expect(tip!.startsWith('Share ')).toBe(true)
      expect(tip!.length).toBeLessThanOrEqual(200)
    }
    expect(Object.keys(ATTORNEY_EVENT_REFERRAL_USAGE_TIPS)).toHaveLength(24)
    expect(Object.keys(ATTORNEY_EVENT_REFERRAL_LABELS)).toHaveLength(24)
    for (const slug of slugs) {
      expect(ATTORNEY_EVENT_REFERRAL_LABELS[slug]).toBeTruthy()
    }
  })

  test('usage tips are attorney guidance, not raw subheads', () => {
    const tip = attorneyEventReferralUsageTip('selling-a-business')
    expect(tip).toContain('Share when')
    expect(tip).not.toMatch(/^When a business represents/)
  })
})
