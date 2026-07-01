import { test, expect } from '@playwright/test'
import {
  ATTORNEY_FREE_CLIENTS,
  attorneyBillableBeforeFloor,
  attorneyConnectionLimitSeedFromCheckoutQuantity,
  attorneyBillingFloorFromClientLimit,
  computeAttorneyRatchetedBillingFloor,
  resolveAttorneyBillableQuantity,
  attorneyProjectedBillableAfterConnect,
} from '@/lib/billing/attorneyBillableQuantity'
import { rateForCount, ATTORNEY_BANDS, ATTORNEY_FLOOR } from '@/lib/pricing/connectionPricing'
import { resolveStickyBillableQuantity } from '@/lib/billing/firmConnectionStickyFloor'

test.describe('attorneyBillableQuantity — contract table', () => {
  test('0 connected → billable 0', () => {
    expect(resolveAttorneyBillableQuantity(0, 0)).toBe(0)
  })

  test('1 connected → billable 0 (free client)', () => {
    expect(resolveAttorneyBillableQuantity(1, 0)).toBe(0)
    expect(resolveAttorneyBillableQuantity(1, 2)).toBe(0)
  })

  test('2 connected → billable 1', () => {
    expect(resolveAttorneyBillableQuantity(2, 0)).toBe(1)
  })

  test('3 connected → billable 2', () => {
    expect(resolveAttorneyBillableQuantity(3, 0)).toBe(2)
    expect(resolveAttorneyBillableQuantity(3, 2)).toBe(2)
  })

  test('11 connected → billable 10, Starter band (free excluded from band)', () => {
    const billable = resolveAttorneyBillableQuantity(11, 0)
    expect(billable).toBe(10)
    expect(rateForCount(billable, ATTORNEY_BANDS, ATTORNEY_FLOOR)).toBe(75)
  })

  test('12 connected → billable 11, Growth band off billable', () => {
    const billable = resolveAttorneyBillableQuantity(12, 0)
    expect(billable).toBe(11)
    expect(rateForCount(billable, ATTORNEY_BANDS, ATTORNEY_FLOOR)).toBe(64)
  })

  test('gate projected billable for 2nd client', () => {
    expect(attorneyProjectedBillableAfterConnect(1)).toBe(1)
    expect(attorneyProjectedBillableAfterConnect(0)).toBe(0)
  })

  test('webhook seed splits ceiling and floor', () => {
    expect(attorneyConnectionLimitSeedFromCheckoutQuantity(1)).toEqual({
      billing_floor: 1,
      client_limit: 1 + ATTORNEY_FREE_CLIENTS,
    })
  })

  test('ratchet on billable not raw connected', () => {
    expect(computeAttorneyRatchetedBillingFloor(0, 3)).toBe(2)
    expect(computeAttorneyRatchetedBillingFloor(2, 3)).toBe(2)
  })

  test('reset floor from client limit ceiling', () => {
    expect(attorneyBillingFloorFromClientLimit(3)).toBe(2)
  })

  test('advisor sticky math unchanged — no free offset', () => {
    expect(resolveStickyBillableQuantity(3, 2)).toBe(3)
    expect(attorneyBillableBeforeFloor(3)).toBe(2)
  })
})
