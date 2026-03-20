import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './_billing-client'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { TIER_FEATURES } from '@/lib/tiers'

const CONSUMER_PRICE_IDS = [
  'price_1TD2SMCaljka9gJtsbsXsPjC', // Financial $9
  'price_1TD2TECaljka9gJtp8fpf3Yk', // Retirement $19
  'price_1TD2WZCaljka9gJt5xUAnv4J', // Estate $34
]

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan, role, consumer_tier')
    .eq('id', user.id)
    .single()

  const isAdvisor = profile?.role === 'advisor'

  // Check if user is an advisor client
  let isAdvisorClient = false
  if (!isAdvisor) {
    const { data: clientRow } = await supabase
      .from('advisor_clients')
      .select('id')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    isAdvisorClient = !!clientRow
  }

  // Fetch advisor tier info if applicable
  let advisorTier = null
  let advisorClientCount = 0
  if (isAdvisor) {
    const { data: tiers } = await supabase
      .from('advisor_tiers')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
    const currentTier = tiers?.find(
      t => t.stripe_price_id === profile?.subscription_plan
    ) ?? tiers?.[0] ?? null
    advisorTier = { tiers: tiers ?? [], currentTier }
    const { count } = await supabase
      .from('advisor_clients')
      .select('id', { count: 'exact', head: true })
      .eq('advisor_id', user.id)
      .eq('status', 'active')
      .not('client_id', 'is', null)
    advisorClientCount = count ?? 0
  }

  // Fetch consumer plans from Stripe
  const plans = isAdvisor ? [] : await Promise.all(
    CONSUMER_PRICE_IDS.map(async id => {
      const price = await stripe.prices.retrieve(id, { expand: ['product'] })
      const product = price.product as Stripe.Product
      const tierMap: Record<string, 1 | 2 | 3> = {
        'price_1TD2SMCaljka9gJtsbsXsPjC': 1,
        'price_1TD2TECaljka9gJtp8fpf3Yk': 2,
        'price_1TD2WZCaljka9gJt5xUAnv4J': 3,
      }
      const tier = tierMap[id] ?? 1
      return {
        priceId: price.id,
        name: product.name,
        description: product.description ?? '',
        features: TIER_FEATURES[tier] as unknown as string[],
        amount: price.unit_amount ?? 0,
        currency: price.currency,
        interval: price.recurring?.interval ?? 'month',
        highlighted: tier === 2,
      }
    })
  )

  return (
    <BillingClient
      plans={plans}
      currentPlan={profile?.subscription_plan ?? null}
      subscriptionStatus={profile?.subscription_status ?? null}
      isAdvisor={isAdvisor}
      isAdvisorClient={isAdvisorClient}
      advisorTier={advisorTier}
      advisorClientCount={advisorClientCount}
    />
  )
}
