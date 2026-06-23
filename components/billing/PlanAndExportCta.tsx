'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'
import { planAndExportAmountCents } from '@/lib/billing/oneTimePurchases'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

type Props = {
  returnTo?: string
  variant?: 'gated' | 'card'
}

export function PlanAndExportCta({ returnTo = '/print', variant = 'gated' }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const priceCents = planAndExportAmountCents()
  const priceDisplay = `$${(priceCents / 100).toLocaleString('en-US')}`
  const estateMonthly = getConsumerPlanDisplay(3, 'monthly').monthlyEquivalent
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
        <p className="text-sm leading-relaxed text-neutral-600">{disclosure}</p>
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={loading}
          onClick={() => void handleBuy()}
          className="w-full rounded-lg py-2.5 text-sm font-medium sm:w-auto"
        >
          {loading ? 'Redirecting…' : `Buy Plan & Export — ${priceDisplay}`}
        </Button>
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
