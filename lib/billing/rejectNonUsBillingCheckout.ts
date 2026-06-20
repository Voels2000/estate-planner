import type Stripe from 'stripe'

export function getCheckoutBillingCountry(session: Stripe.Checkout.Session): string | null {
  return session.customer_details?.address?.country ?? null
}

/**
 * Cancel subscription when billing country is non-US. Returns true when checkout
 * should not be provisioned. Missing country → allow (Stripe may omit on some paths).
 */
export async function rejectNonUsBillingCheckout(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
  onCancelFailed: (err: unknown) => void,
): Promise<boolean> {
  const billingCountry = getCheckoutBillingCountry(session)
  if (!billingCountry || billingCountry === 'US') {
    return false
  }

  console.log(
    `checkout.session.completed — non-US billing (${billingCountry}), canceling subscription`,
  )

  const subId = session.subscription
  if (typeof subId === 'string') {
    try {
      await stripe.subscriptions.cancel(subId)
    } catch (err) {
      onCancelFailed(err)
    }
  }

  return true
}
