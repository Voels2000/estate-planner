import {
  hasDeliverableDownloadAccess,
  hasDeliverableUpdateAccess,
} from '@/lib/access/requirePaidDownloadAccess'
import {
  getUserPlanExportPurchase,
  toPlanExportPurchaseContext,
} from '@/lib/billing/oneTimePurchases'
import { shouldOfferPlanAndExportPurchase } from '@/lib/billing/shouldOfferPlanAndExportPurchase'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { CONNECTED_ADVISOR_CLIENT_STATUSES } from '@/lib/advisor/clientConnectionStatus'
import { DELIVERABLE_MIN_TIER } from '@/lib/tiers'
import { isAdvisorIdentity } from '@/lib/access/isAdvisorIdentity'
import { PrintClient } from './_print-client'

export default async function PrintPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: household } = await supabase
    .from('households')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!household) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, consumer_tier, subscription_status, subscription_plan')
    .eq('id', user.id)
    .single()

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
    role: profile?.role ?? 'consumer',
    consumer_tier: profile?.consumer_tier ?? 0,
    subscription_status: profile?.subscription_status ?? 'none',
  }

  const accessOptions = { planExportPurchase }

  const advisorIdentity = isAdvisorIdentity(profile?.role)

  const canUpdateDeliverable =
    advisorIdentity ||
    hasDeliverableUpdateAccess(profileAccess, DELIVERABLE_MIN_TIER, accessOptions)

  const canDownloadDeliverable =
    advisorIdentity ||
    hasDeliverableDownloadAccess(profileAccess, DELIVERABLE_MIN_TIER, accessOptions)

  const showPlanAndExportOffer = shouldOfferPlanAndExportPurchase({
    profile: profileAccess,
    canDownloadDeliverable,
    isAdvisorClient: !!clientRow,
    subscription_plan: profile?.subscription_plan ?? null,
  })

  return (
    <PrintClient
      householdId={household.id}
      isAdvisor={advisorIdentity}
      canUpdateDeliverable={canUpdateDeliverable}
      canDownloadDeliverable={canDownloadDeliverable}
      showPlanAndExportOffer={showPlanAndExportOffer}
    />
  )
}
