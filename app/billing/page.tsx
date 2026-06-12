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
    .select('subscription_status, subscription_plan, subscription_period_end, role')
    .eq('id', access.user.id)
    .single()

  const isAdvisorManaged =
    profile?.subscription_status === 'advisor_managed' ||
    profile?.subscription_plan === 'advisor_managed'

  if (isAdvisorManaged) {
    return (
      <div className="mx-auto mt-16 max-w-2xl px-6">
        <Card className="border-blue-200 bg-blue-50 px-6 py-5">
          <h2 className="mb-1 text-lg font-semibold text-blue-900">
            Your plan is managed by your advisor
          </h2>
          <p className="text-sm text-blue-800">
            No payment required. Your advisor covers access to MyWealthMaps on your behalf. Contact
            your advisor if you have billing questions.
          </p>
        </Card>
      </div>
    )
  }

  const isAttorneyManaged =
    profile?.subscription_status === 'attorney_managed' ||
    profile?.subscription_plan === 'attorney_managed'

  if (isAttorneyManaged) {
    return (
      <div className="mx-auto mt-16 max-w-2xl px-6">
        <Card className="border-blue-200 bg-blue-50 px-6 py-5">
          <h2 className="mb-1 text-lg font-semibold text-blue-900">
            Your plan is managed by your attorney
          </h2>
          <p className="text-sm text-blue-800">
            No payment required for this planning access while connected. Your attorney&apos;s firm
            covers MyWealthMaps as part of your engagement. Contact your attorney if you have billing
            questions.
          </p>
        </Card>
      </div>
    )
  }

  const { data: clientRow } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('client_id', access.user.id)
    .in('status', ['active', 'accepted'])
    .maybeSingle()
  const isAdvisorClient = !!clientRow

  return (
    <BillingClient
      currentPlan={profile?.subscription_plan ?? null}
      subscriptionStatus={profile?.subscription_status ?? null}
      subscriptionPeriodEnd={profile?.subscription_period_end ?? null}
      subscribedPeriod={getSubscribedBillingPeriod(profile?.subscription_plan ?? null)}
      isAdvisorClient={isAdvisorClient}
      annualBillingAvailable={isAnnualBillingConfigured()}
      recommendedPlanId={recommendedPlanId}
    />
  )
}
