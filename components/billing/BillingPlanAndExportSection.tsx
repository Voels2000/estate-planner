'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'
import { Button } from '@/components/ui/Button'

type Props = {
  returnTo?: string
}

/** One-time deliverable block — separate from subscription ladder (BILLING_PAGE_COPY_SPEC). */
export function BillingPlanAndExportSection({ returnTo = '/print' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceCents = planAndExportAmountCents()
  const priceDisplay = `$${(priceCents / 100).toLocaleString('en-US')}`
  const disclosure = BILLING_DISCLOSURES.planAndExportCheckout(priceDisplay)

  async function handleBuy() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'plan_and_export', returnTo }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Checkout failed. Please try again.')
        setLoading(false)
        return
      }
      window.location.assign(data.url)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

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
      <p className="mt-2 text-xs text-[color:var(--mwm-text-muted)]">{disclosure}</p>
      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="primary"
        disabled={loading}
        onClick={() => void handleBuy()}
        className="mt-5 rounded-lg px-5 py-2.5 text-sm font-medium"
      >
        {loading ? 'Redirecting…' : `Buy Plan & Export — ${priceDisplay}`}
      </Button>
    </section>
  )
}
