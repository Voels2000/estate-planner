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

export type ConsumerCheckoutProfile = {
  subscription_status?: string | null
  subscription_plan?: string | null
  /**
   * True only when the caller found an advisor_clients row with status in
   * CONNECTED_ADVISOR_CLIENT_STATUSES (active | accepted). Pending, declined,
   * removed, and consumer_requested links must leave this false.
   */
  isAdvisorClient?: boolean
}

export type ConsumerCheckoutBlockCode =
  | 'already_subscribed'
  | 'past_due'
  | 'advisor_managed'
  | 'attorney_managed'
  | 'advisor_client'

export type ConsumerCheckoutBlock = {
  code: ConsumerCheckoutBlockCode
  httpStatus: 403 | 409
  message: string
}

const ACTIVE_CONSUMER_SUB_STATUSES = new Set(['active', 'trialing', 'canceling'])
const DELINQUENT_CONSUMER_SUB_STATUSES = new Set(['past_due', 'unpaid'])

function isAdvisorManagedConsumer(profile: ConsumerCheckoutProfile): boolean {
  return (
    profile.subscription_status === 'advisor_managed' ||
    profile.subscription_plan === 'advisor_managed'
  )
}

function isAttorneyManagedConsumer(profile: ConsumerCheckoutProfile): boolean {
  return (
    profile.subscription_status === 'attorney_managed' ||
    profile.subscription_plan === 'attorney_managed'
  )
}

/** Canonical rule: may this household start a self-serve consumer Stripe checkout? */
export function consumerCheckoutBlockReason(
  profile: ConsumerCheckoutProfile | null | undefined,
): ConsumerCheckoutBlock | null {
  if (!profile) return null

  if (isAdvisorManagedConsumer(profile)) {
    return {
      code: 'advisor_managed',
      httpStatus: 403,
      message:
        'Your plan is managed by your advisor. Self-serve checkout is not available.',
    }
  }

  if (isAttorneyManagedConsumer(profile)) {
    return {
      code: 'attorney_managed',
      httpStatus: 403,
      message:
        'Your plan is managed by your attorney. Self-serve checkout is not available.',
    }
  }

  if (profile.isAdvisorClient) {
    return {
      code: 'advisor_client',
      httpStatus: 403,
      message: 'Your plan is managed by your advisor.',
    }
  }

  const status = profile.subscription_status ?? 'none'

  if (DELINQUENT_CONSUMER_SUB_STATUSES.has(status)) {
    return {
      code: 'past_due',
      httpStatus: 409,
      message: 'Resolve your past-due payment before starting a new subscription.',
    }
  }

  if (ACTIVE_CONSUMER_SUB_STATUSES.has(status)) {
    return {
      code: 'already_subscribed',
      httpStatus: 409,
      message:
        'You already have an active subscription. Use Manage billing to change or cancel your plan.',
    }
  }

  return null
}

/** Blocks for one-time SKU checkout — allows active tier-1 subscribers (deliverable upsell). */
export function consumerOneTimeCheckoutBlockReason(
  profile: ConsumerCheckoutProfile | null | undefined,
): ConsumerCheckoutBlock | null {
  if (!profile) return null

  if (isAdvisorManagedConsumer(profile)) {
    return {
      code: 'advisor_managed',
      httpStatus: 403,
      message:
        'Your plan is managed by your advisor. Self-serve checkout is not available.',
    }
  }

  if (isAttorneyManagedConsumer(profile)) {
    return {
      code: 'attorney_managed',
      httpStatus: 403,
      message:
        'Your plan is managed by your attorney. Self-serve checkout is not available.',
    }
  }

  if (profile.isAdvisorClient) {
    return {
      code: 'advisor_client',
      httpStatus: 403,
      message: 'Your plan is managed by your advisor.',
    }
  }

  const status = profile.subscription_status ?? 'none'

  if (DELINQUENT_CONSUMER_SUB_STATUSES.has(status)) {
    return {
      code: 'past_due',
      httpStatus: 409,
      message: 'Resolve your past-due payment before starting checkout.',
    }
  }

  return null
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
