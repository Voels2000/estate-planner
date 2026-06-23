import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  consumerCheckoutBlockReason,
  consumerOneTimeCheckoutBlockReason,
  type ConsumerCheckoutBlock,
  type ConsumerCheckoutProfile,
} from '@/lib/billing/b2b2cBillingPolicy'
import {
  getOneTimeSkuConfig,
  PLAN_AND_EXPORT_SKU,
} from '@/lib/billing/stripePrices'

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

type CheckoutCustomerInput = {
  user: { id: string; email?: string | null }
  billingProfile: ConsumerCheckoutBillingProfile | null
  stripe: ConsumerCheckoutStripe
  admin: SupabaseClient
}

async function ensureStripeCustomerId(input: CheckoutCustomerInput): Promise<string> {
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

  return stripeCustomerId
}

async function buildConsumerCheckoutSuccessUrl(
  input: Pick<ProcessConsumerCheckoutInput, 'user' | 'returnTo' | 'baseUrl' | 'supabase'>,
): Promise<string> {
  if (input.returnTo) {
    const safePath = input.returnTo.startsWith('/') ? input.returnTo : '/dashboard'
    return `${input.baseUrl}${safePath}?success=true&session_id={CHECKOUT_SESSION_ID}`
  }

  const { data: profileRole } = await input.supabase
    .from('profiles')
    .select('role')
    .eq('id', input.user.id)
    .single()

  if (profileRole?.role === 'advisor') {
    return `${input.baseUrl}/advisor?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  }

  const { data: household } = await input.supabase
    .from('households')
    .select('person1_name')
    .eq('owner_id', input.user.id)
    .single()
  const isNewUser = !household?.person1_name
  return isNewUser
    ? `${input.baseUrl}/profile?checkout=success&session_id={CHECKOUT_SESSION_ID}`
    : `${input.baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`
}

function assertAbsoluteBaseUrl(baseUrl: string) {
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    throw new Error(
      `Invalid checkout baseUrl (expected absolute http(s) URL): ${baseUrl}`,
    )
  }
}

export type ProcessPlanAndExportCheckoutInput = Omit<
  ProcessConsumerCheckoutInput,
  'priceId' | 'trialDays'
>

export async function processPlanAndExportCheckout(
  input: ProcessPlanAndExportCheckoutInput,
): Promise<ProcessConsumerCheckoutResult> {
  const block = consumerOneTimeCheckoutBlockReason({
    subscription_status: input.billingProfile?.subscription_status,
    subscription_plan: input.billingProfile?.subscription_plan,
    isAdvisorClient: input.isAdvisorClient,
  })
  if (block) {
    return { ok: false, block }
  }

  assertAbsoluteBaseUrl(input.baseUrl)

  const stripeCustomerId = await ensureStripeCustomerId(input)
  const { priceId } = getOneTimeSkuConfig('PLAN_AND_EXPORT')
  const successUrl = await buildConsumerCheckoutSuccessUrl(input)

  const session = await input.stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    billing_address_collection: 'required',
    success_url: successUrl,
    cancel_url: input.returnTo
      ? `${input.baseUrl}/billing?canceled=true&returnTo=${encodeURIComponent(input.returnTo)}`
      : `${input.baseUrl}/billing?canceled=true`,
    metadata: { userId: input.user.id, sku: PLAN_AND_EXPORT_SKU },
  })

  return { ok: true, url: session.url }
}

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

  assertAbsoluteBaseUrl(input.baseUrl)

  const stripeCustomerId = await ensureStripeCustomerId(input)
  const successUrl = await buildConsumerCheckoutSuccessUrl(input)

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
