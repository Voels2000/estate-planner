/**
 * Plan & Export warning email scheduling.
 * Run: npx playwright test tests/unit/planExportWarnings.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  planExportEmailWarningDue,
  isWithinPlanExportFinalWarning,
  computePlanExportEditWindowEndsAt,
} from '../../lib/billing/planExportAccess'

test.describe('planExportEmailWarningDue', () => {
  const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
  const editWindowEndsAt = computePlanExportEditWindowEndsAt(purchasedAt).toISOString()

  test('14-day warning when 10 days remain', () => {
    const now = new Date('2026-03-22T12:00:00.000Z')
    expect(
      planExportEmailWarningDue(editWindowEndsAt, null, null, now),
    ).toBe(14)
  })

  test('3-day warning when 2 days remain', () => {
    const now = new Date('2026-03-30T12:00:00.000Z')
    expect(
      planExportEmailWarningDue(editWindowEndsAt, new Date().toISOString(), null, now),
    ).toBe(3)
  })

  test('no warning after 14d already sent in same bucket', () => {
    const now = new Date('2026-03-22T12:00:00.000Z')
    expect(
      planExportEmailWarningDue(editWindowEndsAt, now.toISOString(), null, now),
    ).toBeNull()
  })

  test('no warning when window closed', () => {
    const now = new Date('2026-05-01T12:00:00.000Z')
    expect(
      planExportEmailWarningDue(editWindowEndsAt, null, null, now),
    ).toBeNull()
  })
})

test.describe('isWithinPlanExportFinalWarning', () => {
  test('true within final 14 days', () => {
    const ends = new Date('2026-04-10T12:00:00.000Z')
    const now = new Date('2026-04-01T12:00:00.000Z')
    expect(isWithinPlanExportFinalWarning(ends.toISOString(), now)).toBe(true)
  })

  test('false before final 14 days', () => {
    const purchasedAt = new Date('2026-01-01T12:00:00.000Z')
    const ends = computePlanExportEditWindowEndsAt(purchasedAt)
    const now = new Date('2026-01-15T12:00:00.000Z')
    expect(isWithinPlanExportFinalWarning(ends.toISOString(), now)).toBe(false)
  })
})
