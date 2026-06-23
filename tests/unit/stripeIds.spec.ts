import { test, expect } from '@playwright/test'
import { resolveInvoiceSubscriptionId } from '@/lib/stripe/stripeIds'
import type Stripe from 'stripe'

test.describe('resolveInvoiceSubscriptionId', () => {
  test('reads direct invoice.subscription string', () => {
    const invoice = { subscription: 'sub_direct' } as Stripe.Invoice
    expect(resolveInvoiceSubscriptionId(invoice)).toBe('sub_direct')
  })

  test('reads invoice.parent.subscription_details.subscription (Basil)', () => {
    const invoice = {
      subscription: null,
      parent: {
        subscription_details: {
          subscription: 'sub_from_parent',
        },
      },
    } as unknown as Stripe.Invoice
    expect(resolveInvoiceSubscriptionId(invoice)).toBe('sub_from_parent')
  })

  test('returns null when no subscription reference', () => {
    const invoice = {} as Stripe.Invoice
    expect(resolveInvoiceSubscriptionId(invoice)).toBeNull()
  })
})
