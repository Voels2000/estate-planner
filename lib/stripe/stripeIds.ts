import type Stripe from 'stripe'

type InvoiceWithParent = Stripe.Invoice & {
  parent?: {
    subscription_details?: {
      subscription?: string | { id?: string } | null
    } | null
  } | null
}

export function resolveStripeCustomerId(
  customer: Stripe.Subscription['customer'] | Stripe.Invoice['customer'] | Stripe.Checkout.Session['customer'],
): string | null {
  if (typeof customer === 'string') return customer
  if (customer && typeof customer === 'object' && 'id' in customer && customer.id) {
    return customer.id
  }
  return null
}

/** Basil: invoice.subscription may move under invoice.parent; try both. */
export function resolveInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const direct =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id ?? null
  if (direct) return direct

  const parentSub = (invoice as InvoiceWithParent).parent?.subscription_details?.subscription
  if (typeof parentSub === 'string') return parentSub
  if (parentSub && typeof parentSub === 'object' && 'id' in parentSub) {
    return parentSub.id ?? null
  }

  return null
}
