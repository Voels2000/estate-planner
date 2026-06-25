import { createClient } from '@/lib/supabase/server'
import { BillingClient } from './_billing-client'
import { FirmBillingClient } from './_firm-billing-client'
import { redirect } from 'next/navigation'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  ADVISOR_FIRM_PRICE_IDS,
  FIRM_PRICE_ID_TO_TIER,
  ADVISOR_FIRM_SEAT_RATES,
} from '@/lib/tiers'
import { getAccessContext } from '@/lib/access/getAccessContext'
import { isAnnualBillingConfigured } from '@/lib/billing/stripePrices'
import { getSubscribedBillingPeriod } from '@/lib/billing/subscribedBillingPeriod'
import { consumerCheckoutBlockReason } from '@/lib/billing/b2b2cBillingPolicy'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import {
  getUserPlanExportPurchase,
  toPlanExportPurchaseContext,
} from '@/lib/billing/oneTimePurchases'
import { shouldOfferPlanAndExportPurchase } from '@/lib/billing/shouldOfferPlanAndExportPurchase'
import { hasDeliverableDownloadAccess } from '@/lib/billing/planExportAccess'
import { createAdminClient } from '@/lib/supabase/admin'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; returnTo?: string }>
}) {
  const params = await searchParams
  const recommendedPlanId =
    params.plan === 'financial' || params.plan === 'retirement' || params.plan === 'estate'
      ? params.plan
      : null

  const access = await getAccessContext()
  if (!access.user) redirect('/login')

  if (access.isAdvisor) {
    if (!access.isFirmOwner) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <Card className="p-8">
            <div className="mb-4 text-4xl">🏢</div>
            <h1 className="text-2xl font-bold text-neutral-900">Billing</h1>
            <p className="mt-4 leading-relaxed text-neutral-600">
              Your billing is managed by your firm owner. Contact your firm administrator for
              billing questions.
            </p>
            <div className="mt-10">
              <ButtonLink href="/dashboard" variant="link" className="text-sm font-medium">
                ← Back to Dashboard
              </ButtonLink>
            </div>
          </Card>
        </div>
      )
    }

    if (!access.firm_id) {
      return (
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <Card className="p-8">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="text-2xl font-bold text-neutral-900">Firm not linked</h1>
            <p className="mt-4 text-neutral-600">
              Your account is not associated with a firm. Contact support if this is unexpected.
            </p>
            <div className="mt-10">
              <ButtonLink href="/dashboard" variant="link" className="text-sm font-medium">
                ← Back to Dashboard
              </ButtonLink>
            </div>
          </Card>
        </div>
      )
    }

    const supabase = await createClient()
    const { data: firmRow } = await supabase
      .from('firms')
      .select('stripe_customer_id, stripe_subscription_id, subscription_status, tier, seat_count')
      .eq('id', access.firm_id)
      .single()

    type FirmTierKey = keyof typeof ADVISOR_FIRM_SEAT_RATES
    const firmTierKey = (
      (firmRow?.tier ?? access.firm_tier) &&
      (firmRow?.tier ?? access.firm_tier) in ADVISOR_FIRM_SEAT_RATES
        ? (firmRow?.tier ?? access.firm_tier)
        : 'starter'
    ) as FirmTierKey
    const firmCheckoutPriceId =
      ADVISOR_FIRM_PRICE_IDS[firmTierKey as keyof typeof ADVISOR_FIRM_PRICE_IDS]
    const checkoutTier =
      FIRM_PRICE_ID_TO_TIER[firmCheckoutPriceId as keyof typeof FIRM_PRICE_ID_TO_TIER]
    const perSeatRate = ADVISOR_FIRM_SEAT_RATES[firmTierKey]
    const seatCount = firmRow?.seat_count ?? access.seat_count ?? 0
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

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'subscription_status, subscription_plan, subscription_period_end, role, consumer_tier',
    )
    .eq('id', access.user.id)
    .single()

  const { data: clientRow } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('client_id', access.user.id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()
  const isAdvisorClient = !!clientRow

  const planExportPurchase = toPlanExportPurchaseContext(
    await getUserPlanExportPurchase(createAdminClient(), access.user.id),
  )

  const profileAccess = {
    role: profile?.role ?? 'consumer',
    consumer_tier: profile?.consumer_tier ?? 1,
    subscription_status: profile?.subscription_status ?? 'none',
  }

  const canDownloadDeliverable = hasDeliverableDownloadAccess(
    profileAccess,
    DELIVERABLE_MIN_TIER,
    { planExportPurchase },
  )

  const showPlanAndExportOffer =
    profile?.role === 'consumer' &&
    shouldOfferPlanAndExportPurchase({
      profile: profileAccess,
      canDownloadDeliverable,
      isAdvisorClient,
      subscription_plan: profile.subscription_plan,
    })

  const checkoutBlock = consumerCheckoutBlockReason({
    subscription_status: profile?.subscription_status,
    subscription_plan: profile?.subscription_plan,
    isAdvisorClient,
  })

  if (checkoutBlock?.code === 'advisor_managed') {
    return (
      <div className="mx-auto mt-16 max-w-2xl px-6">
        <Card className="border-blue-200 bg-blue-50 px-6 py-5">
          <h2 className="mb-1 text-lg font-semibold text-blue-900">
            Your plan is managed by your advisor
          </h2>
          <p className="text-sm text-blue-800">
            No payment required. Your advisor covers access to My Wealth Maps on your behalf. Contact
            your advisor if you have billing questions.
          </p>
        </Card>
      </div>
    )
  }

  if (checkoutBlock?.code === 'attorney_managed') {
    return (
      <div className="mx-auto mt-16 max-w-2xl px-6">
        <Card className="border-blue-200 bg-blue-50 px-6 py-5">
          <h2 className="mb-1 text-lg font-semibold text-blue-900">
            Your plan is managed by your attorney
          </h2>
          <p className="text-sm text-blue-800">
            No payment required for this planning access while connected. Your attorney&apos;s firm
            covers My Wealth Maps as part of your engagement. Contact your attorney if you have billing
            questions.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <BillingClient
      currentPlan={profile?.subscription_plan ?? null}
      subscriptionStatus={profile?.subscription_status ?? null}
      subscriptionPeriodEnd={profile?.subscription_period_end ?? null}
      subscribedPeriod={getSubscribedBillingPeriod(profile?.subscription_plan ?? null)}
      isAdvisorClient={checkoutBlock?.code === 'advisor_client'}
      annualBillingAvailable={isAnnualBillingConfigured()}
      recommendedPlanId={recommendedPlanId}
      showPlanAndExportOffer={showPlanAndExportOffer}
    />
  )
}
