const APP_TRIAL_DAYS = 7

export type BillingTrialBannerState = {
  endsAt: Date
  daysRemaining: number
  urgent: boolean
  trialEndLabel: string
  /** calm copy (days 1–4) vs urgent (≤3 days left in 7-day window) */
  variant: 'calm' | 'urgent'
}

function formatTrialEndDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function buildState(endsAt: Date): BillingTrialBannerState {
  const msRemaining = endsAt.getTime() - Date.now()
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)))
  const urgent = daysRemaining <= 3

  return {
    endsAt,
    daysRemaining,
    urgent,
    trialEndLabel: formatTrialEndDate(endsAt),
    variant: urgent ? 'urgent' : 'calm',
  }
}

/**
 * App-managed trial (trial_ends_at) with legacy Stripe trialing fallback until restructure ships.
 */
export function resolveBillingTrialBanner(input: {
  trialEndsAt: string | null | undefined
  hasEverSubscribed: boolean | null | undefined
  subscriptionStatus: string | null | undefined
  subscriptionPeriodEnd: string | null | undefined
}): BillingTrialBannerState | null {
  const now = Date.now()

  if (input.trialEndsAt && !input.hasEverSubscribed) {
    const endsAt = new Date(input.trialEndsAt)
    if (Number.isFinite(endsAt.getTime()) && endsAt.getTime() > now) {
      return buildState(endsAt)
    }
  }

  if (input.subscriptionStatus === 'trialing' && input.subscriptionPeriodEnd) {
    const endsAt = new Date(input.subscriptionPeriodEnd)
    if (Number.isFinite(endsAt.getTime()) && endsAt.getTime() > now) {
      return buildState(endsAt)
    }
  }

  return null
}

export function billingTrialBannerCalmCopy(trialEndLabel: string): string {
  return `You're on your ${APP_TRIAL_DAYS}-day full-access trial — every feature is unlocked through ${trialEndLabel}. After that, you'll choose the plan that fits. Whatever you decide, the information you entered stays yours and you can export it anytime.`
}

export function billingTrialBannerUrgentCopy(daysRemaining: number): string {
  const dayWord = daysRemaining === 1 ? 'day' : 'days'
  return `Your full-access trial ends in ${daysRemaining} ${dayWord}. Choose a plan to keep your projections and scenarios — your data stays yours either way.`
}
