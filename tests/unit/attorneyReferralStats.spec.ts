import { test, expect } from '@playwright/test'
import { aggregateAttorneyReferralClicks } from '../../lib/attorney/attorneyReferralStats'
import { attorneyEventReferralUsageTip } from '../../lib/attorney/attorneyEventReferralKit'

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
  test('derives usage tip from event subhead', () => {
    const tip = attorneyEventReferralUsageTip('selling-a-business')
    expect(tip).toBeTruthy()
    expect(tip!.length).toBeLessThanOrEqual(140)
  })
})
