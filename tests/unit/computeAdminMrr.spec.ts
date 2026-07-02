import { test, expect } from '@playwright/test'
import {
  computeAdminMrr,
  firmConnectionMonthlyRevenue,
} from '../../lib/billing/computeAdminMrr'

test.describe('computeAdminMrr A4', () => {
  const originalFlag = process.env.CONNECTION_BILLING_ENABLED

  test.afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.CONNECTION_BILLING_ENABLED
    } else {
      process.env.CONNECTION_BILLING_ENABLED = originalFlag
    }
  })

  test('firmConnectionMonthlyRevenue uses sticky floor + advisor bands', () => {
    // 2 connected, floor 0 → 2 × $120 = $240
    expect(
      firmConnectionMonthlyRevenue({ connected_count: 2, billing_floor: 0 }),
    ).toBe(240)
    // floor above connected → billable = floor
    expect(
      firmConnectionMonthlyRevenue({ connected_count: 1, billing_floor: 3 }),
    ).toBe(360)
  })

  test('flag OFF: firm MRR uses seat_count × tier rate', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    const { firmMrr } = computeAdminMrr(
      [],
      [{ seat_count: 2, tier: 'starter', connected_count: 5, billing_floor: 5 }],
      [],
    )
    expect(firmMrr).toBe(2 * 149)
  })

  test('flag ON: firm MRR uses connection math not seats', () => {
    process.env.CONNECTION_BILLING_ENABLED = 'true'
    const { firmMrr } = computeAdminMrr(
      [],
      [{ seat_count: 10, tier: 'starter', connected_count: 2, billing_floor: 0 }],
      [],
    )
    expect(firmMrr).toBe(240)
  })
})
