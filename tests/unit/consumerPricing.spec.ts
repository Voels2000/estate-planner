import { test, expect } from '@playwright/test'
import { getConsumerPlanDisplay } from '../../lib/billing/stripePrices'
import {
  CONSUMER_ANNUAL_TOTALS,
  CONSUMER_TIERS,
  consumerMonthlyPriceForPlanTier,
} from '../../lib/pricing/connectionPricing'
import { TIER_PRICES } from '../../lib/tiers'

test.describe('consumer pricing A1', () => {
  test('CONSUMER_TIERS is the v1 list prices', () => {
    expect(CONSUMER_TIERS).toEqual({ financial: 19, retirement: 49, estate: 79 })
  })

  test('TIER_PRICES mirrors CONSUMER_TIERS', () => {
    expect(TIER_PRICES[1]).toBe(CONSUMER_TIERS.financial)
    expect(TIER_PRICES[2]).toBe(CONSUMER_TIERS.retirement)
    expect(TIER_PRICES[3]).toBe(CONSUMER_TIERS.estate)
    expect(consumerMonthlyPriceForPlanTier(1)).toBe(19)
  })

  test('annual totals stay at 10× monthly', () => {
    expect(CONSUMER_ANNUAL_TOTALS).toEqual({ financial: 190, retirement: 490, estate: 790 })
  })

  test('stripePrices display metadata matches CONSUMER_TIERS', () => {
    expect(getConsumerPlanDisplay(1, 'monthly').monthlyEquivalent).toBe(19)
    expect(getConsumerPlanDisplay(2, 'monthly').monthlyEquivalent).toBe(49)
    expect(getConsumerPlanDisplay(3, 'monthly').monthlyEquivalent).toBe(79)
    expect(getConsumerPlanDisplay(1, 'annual').annualTotal).toBe(190)
    expect(getConsumerPlanDisplay(3, 'annual').annualTotal).toBe(790)
  })
})
