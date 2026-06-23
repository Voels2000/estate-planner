import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  consumerCheckoutBlockReason,
  type ConsumerCheckoutBlock,
  type ConsumerCheckoutProfile,
} from '@/lib/billing/b2b2cBillingPolicy'

export type ConsumerCheckoutStripe = {
  customers: Pick<Stripe['customers'], 'create' | 'retrieve'>
  checkout: Pick<Stripe['checkout'], 'sessions'>
}

export type ConsumerCheckoutBillingProfile = ConsumerCheckoutProfile & {
  stripe_customer_id?: string | null
}

export type ProcessConsumerCheckoutInput = {
  user: { id: string; email?: string | null }
  priceId: string
  trialDays: number
  returnTo?: string
  billingProfile: ConsumerCheckoutBillingProfile | null
  isAdvisorClient: boolean
  baseUrl: string
  stripe: ConsumerCheckoutStripe
  supabase: SupabaseClient
  admin: SupabaseClient
}

export type ProcessConsumerCheckoutResult =
  | { ok: false; block: ConsumerCheckoutBlock }
  | { ok: true; url: string | null }

export async function processConsumerCheckout(
  input: ProcessConsumerCheckoutInput,
): Promise<ProcessConsumerCheckoutResult> {
  const block = consumerCheckoutBlockReason({
    subscription_status: input.billingProfile?.subscription_status,
    subscription_plan: input.billingProfile?.subscription_plan,
    isAdvisorClient: input.isAdvisorClient,
  })
  if (block) {
    return { ok: false, block }
  }

  let stripeCustomerId = input.billingProfile?.stripe_customer_id ?? null

  if (stripeCustomerId) {
    try {
      const customer = await input.stripe.customers.retrieve(stripeCustomerId)
      if (customer.deleted) stripeCustomerId = null
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? (error as { code?: string }).code
          : undefined
      if (code === 'resource_missing') {
        stripeCustomerId = null
      } else {
        throw error
      }
    }
  }

  if (!stripeCustomerId) {
    const customer = await input.stripe.customers.create({
      email: input.user.email ?? undefined,
      metadata: { user_id: input.user.id },
    })
    stripeCustomerId = customer.id

    await input.admin
      .from('profiles')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', input.user.id)
  }

  let successUrl: string
  if (input.returnTo) {
    const safePath = input.returnTo.startsWith('/') ? input.returnTo : '/dashboard'
    successUrl = `${input.baseUrl}${safePath}?success=true&session_id={CHECKOUT_SESSION_ID}`
  } else {
    const { data: profileRole } = await input.supabase
      .from('profiles')
      .select('role')
      .eq('id', input.user.id)
      .single()

    if (profileRole?.role === 'advisor') {
      successUrl = `${input.baseUrl}/advisor?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    } else {
      const { data: household } = await input.supabase
        .from('households')
        .select('person1_name')
        .eq('owner_id', input.user.id)
        .single()
      const isNewUser = !household?.person1_name
      successUrl = isNewUser
        ? `${input.baseUrl}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`
        : `${input.baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    }
  }

  if (
    !input.baseUrl.startsWith('http://') &&
    !input.baseUrl.startsWith('https://')
  ) {
    throw new Error(
      `Invalid checkout baseUrl (expected absolute http(s) URL): ${input.baseUrl}`,
    )
  }

  const session = await input.stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: stripeCustomerId,
    line_items: [{ price: input.priceId, quantity: 1 }],
    billing_address_collection: 'required',
    success_url: successUrl,
    cancel_url: input.returnTo
      ? `${input.baseUrl}/billing?canceled=true&returnTo=${encodeURIComponent(input.returnTo)}`
      : `${input.baseUrl}/billing?canceled=true`,
    metadata: { userId: input.user.id },
    subscription_data:
      input.trialDays > 0 ? { trial_period_days: input.trialDays } : undefined,
  })

  return { ok: true, url: session.url }
}
