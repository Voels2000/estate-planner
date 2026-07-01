import { test, expect } from '@playwright/test'
import { ADVISOR_FIRM_PRICE_IDS } from '@/lib/tiers'
import {
  allowedAdvisorFirmCheckoutPriceIds,
  isAdvisorConnectionCheckoutPrice,
  normalizeFirmCheckoutQuantity,
  resolveAdvisorFirmCheckoutPriceId,
} from '@/lib/billing/resolveAdvisorFirmCheckout'

test.describe('resolveAdvisorFirmCheckout', () => {
  const connectionId = 'price_test_advisor_connection'

  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
    delete process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY
  })

  test('flag off uses legacy per-seat tier price', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    expect(resolveAdvisorFirmCheckoutPriceId('growth')).toBe(
      ADVISOR_FIRM_PRICE_IDS.growth,
    )
    expect(resolveAdvisorFirmCheckoutPriceId(null)).toBe(ADVISOR_FIRM_PRICE_IDS.starter)
  })

  test('flag on uses connection price env var', () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = connectionId
    expect(resolveAdvisorFirmCheckoutPriceId('starter')).toBe(connectionId)
    expect(isAdvisorConnectionCheckoutPrice(connectionId)).toBe(true)
    expect(isAdvisorConnectionCheckoutPrice(ADVISOR_FIRM_PRICE_IDS.starter)).toBe(false)
  })

  test('allowed price ids include connection only when flag on', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = connectionId
    expect(allowedAdvisorFirmCheckoutPriceIds().has(connectionId)).toBe(false)

    process.env.CONNECTION_BILLING_ENABLED = 'true'
    expect(allowedAdvisorFirmCheckoutPriceIds().has(connectionId)).toBe(true)
    expect(allowedAdvisorFirmCheckoutPriceIds().has(ADVISOR_FIRM_PRICE_IDS.starter)).toBe(true)
  })

  test('connection quantity allows 1 without legacy tier minimums', () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    process.env.STRIPE_PRICE_ADVISOR_CONNECTION_MONTHLY = connectionId
    expect(normalizeFirmCheckoutQuantity(connectionId, 1, 1)).toEqual({ quantity: 1 })
    expect(normalizeFirmCheckoutQuantity(connectionId, 25, 1)).toEqual({ quantity: 25 })
  })

  test('legacy growth tier enforces minimum seat band', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const growthId = ADVISOR_FIRM_PRICE_IDS.growth
    if (!growthId) {
      test.skip()
      return
    }
    const result = normalizeFirmCheckoutQuantity(growthId, 5, 5)
    expect(result.error).toMatch(/Minimum seat count/)
    expect(result.quantity).toBe(11)
  })
})
