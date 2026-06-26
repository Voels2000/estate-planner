'use client'

import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'
import { PlanAndExportCheckoutActions } from '@/components/billing/PlanAndExportCheckoutActions'

type Props = {
  returnTo?: string
}

/** One-time deliverable block — separate from subscription ladder (BILLING_PAGE_COPY_SPEC). */
export function BillingPlanAndExportSection({ returnTo = '/print' }: Props) {
  const priceCents = planAndExportAmountCents()
  const priceDisplay = `$${(priceCents / 100).toLocaleString('en-US')}`

  return (
    <section
      data-testid="billing-plan-and-export"
      className="mt-12 rounded-2xl border border-[color:var(--mwm-border)] bg-white p-8 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-[color:var(--mwm-navy)]">Just want the plan once?</h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[color:var(--mwm-text-secondary)]">
        <span className="font-semibold text-[color:var(--mwm-navy)]">
          Plan &amp; Export — {priceDisplay}.
        </span>{' '}
        A complete, modeled estate plan you can download and share, with a 90-day window to make
        edits. One-time purchase, not a subscription — and if you subscribe later, it credits toward
        your plan.
      </p>
      <div className="mt-5">
        <PlanAndExportCheckoutActions
          returnTo={returnTo}
          buttonClassName="rounded-lg px-5 py-2.5 text-sm font-medium"
        />
      </div>
    </section>
  )
}
