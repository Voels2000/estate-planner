import { test, expect } from '@playwright/test'
import {
  ADVISOR_BANDS,
  ADVISOR_FLOOR,
  ATTORNEY_BANDS,
  ATTORNEY_FLOOR,
  bandForCount,
  bandsToStripeVolumeTiers,
  rateForCount,
  STRIPE_TAX_CODE_SAAS_BUSINESS,
  STRIPE_TAX_CODE_SAAS_PERSONAL,
} from '@/lib/pricing/connectionPricing'

test.describe('connectionPricing', () => {
  test('maps count to band at boundaries', () => {
    expect(bandForCount(1, ADVISOR_BANDS).rate).toBe(120)
    expect(bandForCount(10, ADVISOR_BANDS).rate).toBe(120)
    expect(bandForCount(11, ADVISOR_BANDS).rate).toBe(102)
    expect(bandForCount(50, ADVISOR_BANDS).rate).toBe(102)
    expect(bandForCount(51, ADVISOR_BANDS).rate).toBe(84)
    expect(bandForCount(150, ADVISOR_BANDS).rate).toBe(84)
    expect(bandForCount(151, ADVISOR_BANDS).rate).toBe(72)
    expect(bandForCount(500, ADVISOR_BANDS).rate).toBe(72)
  })

  test('enforces floor via rateForCount', () => {
    expect(rateForCount(200, ADVISOR_BANDS, ADVISOR_FLOOR)).toBe(72)
    expect(rateForCount(200, ATTORNEY_BANDS, ATTORNEY_FLOOR)).toBe(45)
  })

  test('builds Stripe volume tiers from bands', () => {
    expect(bandsToStripeVolumeTiers(ADVISOR_BANDS)).toEqual([
      { up_to: 10, unit_amount: 12000 },
      { up_to: 50, unit_amount: 10200 },
      { up_to: 150, unit_amount: 8400 },
      { up_to: 'inf', unit_amount: 7200 },
    ])
  })

  test('Stripe SaaS tax codes split personal vs business', () => {
    expect(STRIPE_TAX_CODE_SAAS_PERSONAL).toBe('txcd_10103000')
    expect(STRIPE_TAX_CODE_SAAS_BUSINESS).toBe('txcd_10103001')
  })
})
