import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './_billing-client'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import { TIER_FEATURES } from '@/lib/tiers'

const CONSUMER_PRICE_IDS = [
  'price_1TILBRCaljka9gJt6dr44Znq', // Financial $9
  'price_1TILEXCaljka9gJtrHqnG3bl', // Retirement $19
  'price_1TILGOCaljka9gJtCDLiKFHp', // Estate $34
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
    .select('subscription_status, subscription_plan, role')
    .eq('id', user.id)
    .single()

  const isAdvisor = profile?.role === 'advisor'
  const isActive = profile?.subscription_status === 'active'

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
    const currentTier = isActive
      ? (tiers?.find(t => t.stripe_price_id === profile?.subscription_plan) ?? null)
      : null
    advisorTier = { tiers: tiers ?? [], currentTier }
    const { count } = await supabase
      .from('advisor_clients')
      .select('id', { count: 'exact', head: true })
      .eq('advisor_id', user.id)
      .eq('status', 'active')
      .not('client_id', 'is', null)
    advisorClientCount = count ?? 0
  }

  const priceIdsToShow = isAdvisor
    ? []
    : isActive
      ? CONSUMER_PRICE_IDS
      : [CONSUMER_PRICE_IDS[0]] // Not yet active — show Tier 1 only

  const plans = isAdvisor ? [] : await Promise.all(
    priceIdsToShow.map(async id => {
      const price = await stripe.prices.retrieve(id, { expand: ['product'] })
      const product = price.product as Stripe.Product
      const tierMap: Record<string, 1 | 2 | 3> = {
        'price_1TILBRCaljka9gJt6dr44Znq': 1,
        'price_1TILEXCaljka9gJtrHqnG3bl': 2,
        'price_1TILGOCaljka9gJtCDLiKFHp': 3,
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
