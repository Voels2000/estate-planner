import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './_billing-client'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})

const CONSUMER_PRICE_IDS = [
  'price_1TAlJjCaljka9gJthGTMogQb', // Consumer
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan, role')
    .eq('id', user.id)
    .single()

  const isAdvisor = profile?.role === 'advisor'

  // Fetch advisor tier info if applicable
  let advisorTier = null
  let advisorClientCount = 0

  if (isAdvisor) {
    // Get their current tier from advisor_tiers based on subscription_plan
    const { data: tiers } = await supabase
      .from('advisor_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order')

    // Match current plan to tier by stripe_price_id
    const currentTier = tiers?.find(
      t => t.stripe_price_id === profile?.subscription_plan
    ) ?? tiers?.[0] ?? null

    advisorTier = { tiers: tiers ?? [], currentTier }

    // Count active clients
    const { count } = await supabase
      .from('advisor_clients')
      .select('id', { count: 'exact', head: true })
      .eq('advisor_id', user.id)
      .eq('status', 'active')
      .not('client_id', 'is', null)

    advisorClientCount = count ?? 0
  }

  // Fetch consumer plans from Stripe (shown to non-advisors)
  const plans = isAdvisor ? [] : await Promise.all(
    CONSUMER_PRICE_IDS.map(async id => {
      const price = await stripe.prices.retrieve(id, { expand: ['product'] })
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
  )

  return (
    <BillingClient
      plans={plans}
      currentPlan={profile?.subscription_plan ?? null}
      subscriptionStatus={profile?.subscription_status ?? null}
      isAdvisor={isAdvisor}
      advisorTier={advisorTier}
      advisorClientCount={advisorClientCount}
    />
  )
}
