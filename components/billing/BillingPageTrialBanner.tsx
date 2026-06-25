'use client'

import {
  billingTrialBannerCalmCopy,
  billingTrialBannerUrgentCopy,
  type BillingTrialBannerState,
} from '@/lib/billing/resolveBillingTrialBanner'

export function BillingPageTrialBanner({ state }: { state: BillingTrialBannerState }) {
  const copy =
    state.variant === 'urgent'
      ? billingTrialBannerUrgentCopy(state.daysRemaining)
      : billingTrialBannerCalmCopy(state.trialEndLabel)

  return (
    <div
      role="status"
      data-testid="billing-trial-banner"
      className={`mb-8 rounded-xl border px-5 py-4 text-sm leading-relaxed ${
        state.urgent
          ? 'border-red-200 bg-red-50 text-red-950'
          : 'border-[color:var(--mwm-gold)]/40 bg-[color:var(--mwm-gold)]/10 text-[color:var(--mwm-navy)]'
      }`}
    >
      <p>{copy}</p>
    </div>
  )
}
