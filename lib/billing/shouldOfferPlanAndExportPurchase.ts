import { consumerOneTimeCheckoutBlockReason } from '@/lib/billing/b2b2cBillingPolicy'
import type { DeliverableAccessProfile } from '@/lib/billing/planExportAccess'

export type PlanAndExportOfferInput = {
  profile: DeliverableAccessProfile
  /** From hasDeliverableDownloadAccess — same boolean that gates /print and the export API. */
  canDownloadDeliverable: boolean
  isAdvisorClient?: boolean
  subscription_plan?: string | null
}

/**
 * Show the Plan & Export buy CTA when the deliverable gate says no download access yet
 * (no active tier-3 sub, no completed purchase — including post-window; re-buy disabled)
 * and one-time checkout is not policy-blocked.
 */
export function shouldOfferPlanAndExportPurchase(input: PlanAndExportOfferInput): boolean {
  const { profile, canDownloadDeliverable, isAdvisorClient, subscription_plan } = input
  if (profile.role !== 'consumer') return false
  if (canDownloadDeliverable) return false

  if (
    consumerOneTimeCheckoutBlockReason({
      subscription_status: profile.subscription_status,
      subscription_plan: subscription_plan ?? null,
      isAdvisorClient,
    })
  ) {
    return false
  }

  return true
}
