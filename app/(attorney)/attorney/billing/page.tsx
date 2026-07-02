import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ATTORNEY_PLAN_LIMITS } from '@/lib/tiers'
import { AttorneyBillingClient } from './_attorney-billing-client'
import { AttorneyConnectionBillingClient } from './_attorney-connection-billing-client'
import { isConnectionBillingEnabled } from '@/lib/billing/connectionBillingFlag'
import { getAttorneyListingIdForUser } from '@/lib/attorney/attorneyClientCap'
import { attorneyConnectedHouseholds } from '@/lib/billing/connectedHouseholdCount'
import { buildAttorneyConnectionBillingSummary } from '@/lib/billing/attorneyConnectionBillingSummary'
import { attorneyConnectionCheckoutPriceId } from '@/lib/billing/resolveAttorneyCheckout'

export default async function AttorneyBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; canceled?: string; action?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const sp = await searchParams
  const connectionBillingAction =
    sp.action === 'raise' || sp.action === 'lower' ? sp.action : null

  if (isConnectionBillingEnabled()) {
    const listingId = await getAttorneyListingIdForUser(supabase, user.id)
    if (!listingId) redirect('/attorney')

    const admin = createAdminClient()
    const connectedCount = await attorneyConnectedHouseholds(admin, listingId)
    const { data: listing } = await admin
      .from('attorney_listings')
      .select('firm_name, client_limit, billing_floor, reset_count')
      .eq('id', listingId)
      .single()
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    const summary = buildAttorneyConnectionBillingSummary({
      connectedCount,
      clientLimit: listing?.client_limit,
      billingFloor: listing?.billing_floor,
      resetCount: listing?.reset_count,
    })

    return (
      <AttorneyConnectionBillingClient
        firmName={listing?.firm_name ?? 'Your practice'}
        summary={summary}
        subscriptionStatus={profile?.subscription_status ?? null}
        attorneyCheckoutPriceId={attorneyConnectionCheckoutPriceId()}
        initialAction={connectionBillingAction}
        checkoutSuccess={sp.checkout === 'success'}
        canceled={sp.canceled === 'true'}
      />
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('attorney_tier')
    .eq('id', user.id)
    .single()

  const tier = profile?.attorney_tier ?? 0

  const plans = [
    {
      id: 0,
      name: 'Free',
      price: '$0',
      features: [
        'Read-only client access (up to 3 clients visible)',
        'Document vault upload/download',
        'Basic client list',
      ],
    },
    {
      id: 1,
      planKey: 'starter' as const,
      name: 'Attorney Starter',
      price: `$${ATTORNEY_PLAN_LIMITS.starter.priceMonthly}/mo`,
      features: [
        'Up to 15 client households',
        'Document vault + gap alerts',
        'Intake summary PDF export',
        'Multi-client document health dashboard',
      ],
    },
    {
      id: 2,
      planKey: 'growth' as const,
      name: 'Attorney Growth',
      price: `$${ATTORNEY_PLAN_LIMITS.growth.priceMonthly}/mo`,
      features: [
        'Up to 50 client households',
        'PDF branding on intake exports',
        'Bulk client management',
        'Everything in Starter',
      ],
    },
  ]

  return (
    <AttorneyBillingClient
      currentTier={tier}
      plans={plans}
      checkoutSuccess={sp.checkout === 'success'}
      canceled={sp.canceled === 'true'}
    />
  )
}
