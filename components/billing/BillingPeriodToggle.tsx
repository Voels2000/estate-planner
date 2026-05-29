'use client'

import type { BillingPeriod } from '@/lib/billing/stripePrices'

type Props = {
  period: BillingPeriod
  onChange: (period: BillingPeriod) => void
}

export function BillingPeriodToggle({ period, onChange }: Props) {
  return (
    <div className="mb-8 flex items-center justify-center gap-3">
      <span
        className={`text-sm ${
          period === 'monthly'
            ? 'font-semibold text-[color:var(--mwm-navy)]'
            : 'text-[color:var(--mwm-text-muted)]'
        }`}
      >
        Monthly
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={period === 'annual'}
        aria-label="Toggle annual billing"
        onClick={() => onChange(period === 'monthly' ? 'annual' : 'monthly')}
        className={`relative h-6 w-12 rounded-full transition-colors ${
          period === 'annual' ? 'bg-[color:var(--mwm-navy)]' : 'bg-neutral-200'
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
            period === 'annual' ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
      <span
        className={`text-sm ${
          period === 'annual'
            ? 'font-semibold text-[color:var(--mwm-navy)]'
            : 'text-[color:var(--mwm-text-muted)]'
        }`}
      >
        Annual
        <span className="ml-1.5 rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-green-700">
          2 months free
        </span>
      </span>
    </div>
  )
}
