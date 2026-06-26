'use client'

import Link from 'next/link'
import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'
import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'
import { Card } from '@/components/ui/Card'
import { PlanAndExportCheckoutActions } from '@/components/billing/PlanAndExportCheckoutActions'

type Props = {
  returnTo?: string
  variant?: 'gated' | 'card'
}

export function PlanAndExportCta({ returnTo = '/print', variant = 'gated' }: Props) {
  const priceCents = planAndExportAmountCents()
  const priceDisplay = `$${(priceCents / 100).toLocaleString('en-US')}`
  const estateMonthly = getConsumerPlanDisplay(3, 'monthly').monthlyEquivalent

  const content = (
    <div data-testid="plan-and-export-cta" className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-neutral-700">
          <span className="font-semibold text-[color:var(--mwm-navy)]">Keep your plan current</span>
          {' — '}
          Subscribe to the Estate plan (${estateMonthly}/mo) to update your plan anytime as your
          situation and the law change, with advisor and attorney access.
        </p>
        <Link
          href="/billing?plan=estate"
          className="inline-flex text-sm font-medium text-[color:var(--mwm-navy)] underline underline-offset-2"
        >
          Subscribe to Estate →
        </Link>
      </div>

      <div className="space-y-3 border-t border-neutral-200 pt-5">
        <p className="text-sm leading-relaxed text-neutral-700">
          <span className="font-semibold text-[color:var(--mwm-navy)]">Just need it once?</span>
          {' '}
          Buy Plan &amp; Export for a one-time {priceDisplay} — generate and download your full
          estate plan, yours to keep. Includes 90 days of editing.{' '}
          <span className="font-semibold text-[color:var(--mwm-navy)]">
            If you subscribe later, the {priceDisplay} counts toward your subscription.
          </span>
        </p>
        <PlanAndExportCheckoutActions returnTo={returnTo} />
      </div>
    </div>
  )

  if (variant === 'card') {
    return (
      <Card className="rounded-2xl border border-neutral-200 p-8 shadow-md">
        <h2 className="text-lg font-semibold text-neutral-900">Plan &amp; Export</h2>
        <p className="mt-1 text-sm text-neutral-500">
          One-time estate plan deliverable — not a subscription.
        </p>
        <div className="mt-6">{content}</div>
      </Card>
    )
  }

  return content
}
