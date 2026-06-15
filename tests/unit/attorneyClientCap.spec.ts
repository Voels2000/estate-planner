/**
 * Attorney client cap — free tier blocks assignment at 3 active households.
 * Run: npx playwright test tests/unit/attorneyClientCap.spec.ts --project=import-unit
 */
import { test, expect } from '@playwright/test'
import {
  FREE_ATTORNEY_CLIENT_CAP_MESSAGE,
  isAtAttorneyClientCap,
} from '../../lib/attorney/attorneyClientCap'
import { attorneyTierFeatures } from '../../lib/attorney/attorneyTierLimits'

test.describe('attorneyClientCap', () => {
  test('free tier (0) caps at 3 active households', () => {
    expect(attorneyTierFeatures(0).maxClients).toBe(3)
    expect(isAtAttorneyClientCap(0, 2)).toBe(false)
    expect(isAtAttorneyClientCap(0, 3)).toBe(true)
    expect(isAtAttorneyClientCap(0, 4)).toBe(true)
  })

  test('starter tier (1) caps at 15', () => {
    expect(attorneyTierFeatures(1).maxClients).toBe(15)
    expect(isAtAttorneyClientCap(1, 14)).toBe(false)
    expect(isAtAttorneyClientCap(1, 15)).toBe(true)
  })

  test('unknown tier falls back to free cap', () => {
    expect(attorneyTierFeatures(99).maxClients).toBe(3)
    expect(isAtAttorneyClientCap(99, 3)).toBe(true)
  })

  test('cap message is stable for API responses', () => {
    expect(FREE_ATTORNEY_CLIENT_CAP_MESSAGE).toBe('Free plan limited to 3 client households')
  })
})
