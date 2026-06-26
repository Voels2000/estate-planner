import { test, expect } from '@playwright/test'
import { canUnlockDashboard } from '@/lib/dashboard/canUnlockDashboard'

test.describe('canUnlockDashboard', () => {
  test('profile-only → locked', () => {
    expect(
      canUnlockDashboard({
        profileComplete: true,
        hasAssets: false,
        hasIncome: false,
      }),
    ).toBe(false)
  })

  test('profile + assets, no income → locked', () => {
    expect(
      canUnlockDashboard({
        profileComplete: true,
        hasAssets: true,
        hasIncome: false,
      }),
    ).toBe(false)
  })

  test('profile + income, no assets → locked', () => {
    expect(
      canUnlockDashboard({
        profileComplete: true,
        hasAssets: false,
        hasIncome: true,
      }),
    ).toBe(false)
  })

  test('incomplete profile with assets + income → locked', () => {
    expect(
      canUnlockDashboard({
        profileComplete: false,
        hasAssets: true,
        hasIncome: true,
      }),
    ).toBe(false)
  })

  test('full unlock — profile + assets + income', () => {
    expect(
      canUnlockDashboard({
        profileComplete: true,
        hasAssets: true,
        hasIncome: true,
      }),
    ).toBe(true)
  })

  test('strong-financial-no-docs (avoels case) → unlocked', () => {
    expect(
      canUnlockDashboard({
        profileComplete: true,
        hasAssets: true,
        hasIncome: true,
      }),
    ).toBe(true)
  })

  test('data-rich-no-wizard (david case) → unlocked', () => {
    expect(
      canUnlockDashboard({
        profileComplete: true,
        hasAssets: true,
        hasIncome: true,
      }),
    ).toBe(true)
  })
})
