/**
 * B2B2C consumer billing handoff — when a professional connection should pause
 * the consumer's Stripe subscription and grant managed tier access.
 *
 * See docs/BILLING_B2B2C_POLICY.md
 */

export type B2b2cProfessionalRole = 'advisor' | 'attorney'

export const MANAGED_SUBSCRIPTION_STATUSES = ['advisor_managed', 'attorney_managed'] as const
export type ManagedSubscriptionStatus = (typeof MANAGED_SUBSCRIPTION_STATUSES)[number]

/** Default true — advisor-sponsored Estate access matches eMoney/Holistiplan norms at go-live. */
export function isAdvisorConsumerBillingHandoffEnabled(): boolean {
  return process.env.B2B2C_ADVISOR_CONSUMER_BILLING !== 'false'
}

/** Default false — attorney collaboration only until you flip for a given market. */
export function isAttorneyConsumerBillingHandoffEnabled(): boolean {
  return process.env.B2B2C_ATTORNEY_CONSUMER_BILLING === 'true'
}

export function isConsumerBillingHandoffEnabled(role: B2b2cProfessionalRole): boolean {
  return role === 'advisor'
    ? isAdvisorConsumerBillingHandoffEnabled()
    : isAttorneyConsumerBillingHandoffEnabled()
}

export function managedSubscriptionStatus(role: B2b2cProfessionalRole): ManagedSubscriptionStatus {
  return role === 'advisor' ? 'advisor_managed' : 'attorney_managed'
}

export function managedSubscriptionPlan(role: B2b2cProfessionalRole): ManagedSubscriptionStatus {
  return managedSubscriptionStatus(role)
}

export function isManagedSubscriptionStatus(status: string | null | undefined): boolean {
  return status === 'advisor_managed' || status === 'attorney_managed'
}

export function managedConsumerTier(role: B2b2cProfessionalRole): number {
  if (role === 'advisor') {
    const parsed = parseInt(process.env.B2B2C_ADVISOR_MANAGED_TIER ?? '3', 10)
    return parsed >= 1 && parsed <= 3 ? parsed : 3
  }
  const parsed = parseInt(process.env.B2B2C_ATTORNEY_MANAGED_TIER ?? '2', 10)
  return parsed >= 1 && parsed <= 3 ? parsed : 2
}

export function managedProfessionalLabel(role: B2b2cProfessionalRole): string {
  return role === 'advisor' ? 'advisor' : 'attorney'
}
