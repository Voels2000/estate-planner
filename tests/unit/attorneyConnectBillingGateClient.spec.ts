import { test, expect } from '@playwright/test'
import {
  attorneyCheckoutGateCopy,
  consumerAttorneyBillingBlockedMessage,
} from '../../lib/billing/attorneyConnectBillingGateClient'

test.describe('attorneyConnectBillingGateClient', () => {
  test('checkout modal copy uses billable qty (1 client → $75/mo)', () => {
    const copy = attorneyCheckoutGateCopy(1)
    expect(copy.body).toContain('$75/mo')
    expect(copy.body).toContain('1 billable client')
    expect(copy.body).not.toContain('$150')
  })

  test('consumer blocked message quotes billable subscription at gate', () => {
    const message = consumerAttorneyBillingBlockedMessage(
      { error: 'attorney_checkout_required', quantity: 1 },
      402,
    )
    expect(message).toContain('$75/mo')
    expect(message).toContain('1-client subscription')
    expect(message).not.toContain('$150')
  })
})
