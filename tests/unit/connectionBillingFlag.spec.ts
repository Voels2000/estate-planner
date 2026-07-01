import { test, expect } from '@playwright/test'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'

test.describe('connectionBillingFlag module', () => {
  test.afterEach(() => {
    delete process.env.CONNECTION_BILLING_ENABLED
  })

  test('is false when unset', () => {
    delete process.env.CONNECTION_BILLING_ENABLED
    expect(isConnectionBillingEnabled()).toBe(false)
  })
})
