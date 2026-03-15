import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './_billing-client'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

const PRICE_IDS = [
  'price_1TAlJjCaljka9gJthGTMogQb',  // Consumer
  'price_1TAlRkCaljka9gJtL7jcTwWY',  // Advisor
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch live prices from Stripe
  const prices = await Promise.all(
    PRICE_IDS.map(id => stripe.prices.retrieve(id, { expand: ['product'] }))
  )

  const plans = prices.map(price => {
    const product = price.product as Stripe.Product
    return {
      priceId: price.id,
      name: product.name,
      description: product.description ?? '',
      features: (product.metadata?.features ?? '').split('|').filter(Boolean),
      amount: price.unit_amount ?? 0,
      currency: price.currency,
      interval: price.recurring?.interval ?? 'month',
      highlighted: product.metadata?.highlighted === 'true',
    }
  })

  // Get user's current subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan')
    .eq('id', user!.id)
    .single()

  return (
    <BillingClient
      plans={plans}
      currentPlan={profile?.subscription_plan ?? null}
      subscriptionStatus={profile?.subscription_status ?? null}
    />
  )
}
