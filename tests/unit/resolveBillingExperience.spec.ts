import { test, expect } from '@playwright/test'
import { resolveBillingExperience } from '@/lib/billing/resolveBillingExperience'

test.describe('resolveBillingExperience', () => {
  test('superuser with consumer role gets consumer billing (not firm)', () => {
    expect(
      resolveBillingExperience({
        role: 'consumer',
        isFirmOwner: false,
        firmId: null,
      }),
    ).toBe('consumer')
  })

  test('superuser with advisor role and no firm gets firm_not_linked', () => {
    expect(
      resolveBillingExperience({
        role: 'advisor',
        isFirmOwner: true,
        firmId: null,
      }),
    ).toBe('firm_not_linked')
  })

  test('advisor firm owner with firm gets firm_owner', () => {
    expect(
      resolveBillingExperience({
        role: 'advisor',
        isFirmOwner: true,
        firmId: 'firm-uuid',
      }),
    ).toBe('firm_owner')
  })

  test('advisor firm member gets firm_member', () => {
    expect(
      resolveBillingExperience({
        role: 'advisor',
        isFirmOwner: false,
        firmId: 'firm-uuid',
      }),
    ).toBe('firm_member')
  })
})
