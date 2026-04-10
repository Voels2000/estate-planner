import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './_billing-client'
import { FirmBillingClient } from './_firm-billing-client'
import Stripe from 'stripe'
import { redirect } from 'next/navigation'
import {
  TIER_FEATURES,
  ADVISOR_FIRM_PRICE_IDS,
  FIRM_PRICE_ID_TO_TIER,
  ADVISOR_FIRM_SEAT_RATES,
} from '@/lib/tiers'
import { getAccessContext } from '@/lib/access/getAccessContext'

const CONSUMER_PRICE_IDS = [
  'price_1TILBRCaljka9gJt6dr44Znq', // Financial $9
  'price_1TILEXCaljka9gJtrHqnG3bl', // Retirement $19
  'price_1TILGOCaljka9gJtCDLiKFHp', // Estate $34
]

export default async function BillingPage() {
  const access = await getAccessContext()
  if (!access.user) redirect('/login')

  if (access.isAdvisor) {
    if (!access.isFirmOwner) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mb-4 text-4xl">🏢</div>
          <h1 className="text-2xl font-bold text-neutral-900">Billing</h1>
          <p className="mt-4 text-neutral-600 leading-relaxed">
            Your billing is managed by your firm owner. Contact your firm
            administrator for billing questions.
          </p>
          <a
            href="/dashboard"
            className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Dashboard
          </a>
        </div>
      )
    }

    if (!access.firm_id) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h1 className="text-2xl font-bold text-neutral-900">
            Firm not linked
          </h1>
          <p className="mt-4 text-neutral-600">
            Your account is not associated with a firm. Contact support if this
            is unexpected.
          </p>
          <a
            href="/dashboard"
            className="mt-10 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Dashboard
          </a>
        </div>
      )
    }

    const supabase = await createClient()
    const { data: firmRow } = await supabase
      .from('firms')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status')
      .eq('id', access.firm_id)
      .single()

    if (
      firmRow?.subscription_status === 'active' ||
      firmRow?.subscription_status === 'trialing'
    ) {
      redirect('/advisor')
    }

    type FirmTierKey = keyof typeof ADVISOR_FIRM_SEAT_RATES
    const firmTierKey = (
      access.firm_tier && access.firm_tier in ADVISOR_FIRM_SEAT_RATES
        ? access.firm_tier
        : 'starter'
    ) as FirmTierKey
    const firmCheckoutPriceId =
      ADVISOR_FIRM_PRICE_IDS[firmTierKey as keyof typeof ADVISOR_FIRM_PRICE_IDS]
    const checkoutTier =
      FIRM_PRICE_ID_TO_TIER[firmCheckoutPriceId as keyof typeof FIRM_PRICE_ID_TO_TIER]
    const perSeatRate = ADVISOR_FIRM_SEAT_RATES[firmTierKey]
    const seatCount = access.seat_count ?? 0
    const totalMonthly = perSeatRate * seatCount

    return (
      <FirmBillingClient
        firmName={access.firm_name ?? 'Your firm'}
        firmTierKey={checkoutTier ?? firmTierKey}
        perSeatRate={perSeatRate}
        seatCount={seatCount}
        totalMonthly={totalMonthly}
        subscriptionStatus={firmRow?.subscription_status ?? null}
        firmCheckoutPriceId={firmCheckoutPriceId}
      />
    )
  }

  const supabase = await createClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-24.acacia',
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_plan, role')
    .eq('id', access.user.id)
    .single()

  const isAdvisorManaged =
    profile?.subscription_status === 'advisor_managed' ||
    profile?.subscription_plan === 'advisor_managed'

  if (isAdvisorManaged) {
    return (
      <div className="max-w-2xl mx-auto mt-16 px-6">
        <div className="rounded-md border border-blue-200 bg-blue-50 px-6 py-5">
          <h2 className="text-lg font-semibold text-blue-900 mb-1">
            Your plan is managed by your advisor
          </h2>
          <p className="text-sm text-blue-700">
            No payment required. Your advisor covers access to MyWealthMaps on
            your behalf. Contact your advisor if you have billing questions.
          </p>
        </div>
      </div>
    )
  }

  const isActive = profile?.subscription_status === 'active'

  const { data: clientRow } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('client_id', access.user.id)
    .in('status', ['active', 'accepted'])
    .maybeSingle()
  const isAdvisorClient = !!clientRow

  const priceIdsToShow = isActive
    ? CONSUMER_PRICE_IDS
    : [CONSUMER_PRICE_IDS[0]]

  const plans = await Promise.all(
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
      isAdvisorClient={isAdvisorClient}
    />
  )
}
