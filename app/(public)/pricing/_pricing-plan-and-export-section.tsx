import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import {
  getUserPlanExportPurchase,
  toPlanExportPurchaseContext,
} from '@/lib/billing/oneTimePurchases'
import { shouldOfferPlanAndExportPurchase } from '@/lib/billing/shouldOfferPlanAndExportPurchase'
import { hasDeliverableDownloadAccess } from '@/lib/billing/planExportAccess'
import { PlanAndExportCta } from '@/components/billing/PlanAndExportCta'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'

export async function PricingPlanAndExportSection() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier, subscription_status, subscription_plan')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'consumer') return null

  const { data: clientRow } = await supabase
    .from('advisor_clients')
    .select('id')
    .eq('client_id', user.id)
    .in('status', [...CONNECTED_ADVISOR_CLIENT_STATUSES])
    .maybeSingle()

  const planExportPurchase = toPlanExportPurchaseContext(
    await getUserPlanExportPurchase(createAdminClient(), user.id),
  )

  const profileAccess = {
    role: profile.role,
    consumer_tier: profile.consumer_tier,
    subscription_status: profile.subscription_status,
  }

  const canDownloadDeliverable = hasDeliverableDownloadAccess(
    profileAccess,
    DELIVERABLE_MIN_TIER,
    { planExportPurchase },
  )

  const showOffer = shouldOfferPlanAndExportPurchase({
    profile: profileAccess,
    canDownloadDeliverable,
    isAdvisorClient: !!clientRow,
    subscription_plan: profile.subscription_plan,
  })

  if (!showOffer) return null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto 48px' }}>
      <PlanAndExportCta returnTo="/print" variant="card" />
    </div>
  )
}
