import { test, expect } from '@playwright/test'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'

test.describe('isAdvisorIdentity', () => {
  test('true only for stored advisor role', () => {
    expect(isAdvisorIdentity('advisor')).toBe(true)
    expect(isAdvisorIdentity('consumer')).toBe(false)
    expect(isAdvisorIdentity('attorney')).toBe(false)
    expect(isAdvisorIdentity('admin')).toBe(false)
    expect(isAdvisorIdentity(null)).toBe(false)
    expect(isAdvisorIdentity(undefined)).toBe(false)
  })

  test('superuser capability does not imply advisor identity', () => {
    // Identity is role-only; is_superuser is handled separately for capability.
    expect(isAdvisorIdentity('consumer')).toBe(false)
  })
})
