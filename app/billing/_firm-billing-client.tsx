'use client'

import { useState } from 'react'

const TIER_LABEL: Record<string, string> = {
  starter: 'Starter (1–10 advisors)',
  growth: 'Growth (11–50 advisors)',
  enterprise: 'Enterprise (51–250 advisors)',
}

type Props = {
  firmName: string
  firmTierKey: string
  perSeatRate: number
  seatCount: number
  totalMonthly: number
  subscriptionStatus: string | null
  firmCheckoutPriceId: string
}

export function FirmBillingClient({
  firmName,
  firmTierKey,
  perSeatRate,
  seatCount,
  totalMonthly,
  subscriptionStatus,
  firmCheckoutPriceId,
}: Props) {
  const [loadingSubscribe, setLoadingSubscribe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSubscribed =
    subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
  const showSubscribe = !isSubscribed

  async function handleFirmCheckout() {
    setError(null)
    setLoadingSubscribe(true)
    try {
      const res = await fetch('/api/stripe/firm-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: firmCheckoutPriceId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Something went wrong. Please try again.',
        )
        setLoadingSubscribe(false)
        return
      }
      if (data.url && typeof data.url === 'string') {
        window.location.href = data.url
        return
      }
      setError('Something went wrong. Please try again.')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoadingSubscribe(false)
    }
  }

  const resolvedTierLabel =
    TIER_LABEL[firmTierKey] ?? firmTierKey.replace(/^\w/, (c) => c.toUpperCase())

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6">
        <a
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          ← Back to Dashboard
        </a>
      </div>
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          Firm billing
        </h1>
        <p className="mt-2 text-neutral-600">
          Subscription and seats for your advisory firm.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-neutral-200 shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Firm
          </h2>
          <p className="mt-1 text-lg font-medium text-neutral-900">{firmName}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Current tier</h3>
            <p className="mt-1 text-neutral-900">{resolvedTierLabel}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Per-seat rate</h3>
            <p className="mt-1 text-neutral-900">
              ${perSeatRate}/mo per advisor seat
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">Active seats</h3>
            <p className="mt-1 text-neutral-900">{seatCount}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">
              Total monthly charge
            </h3>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              ${totalMonthly.toLocaleString('en-US')}/mo
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {perSeatRate} × {seatCount} seats
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href="/advisor/firm"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition-colors"
          >
            Manage Subscription
          </a>
          {showSubscribe && (
            <button
              type="button"
              onClick={handleFirmCheckout}
              disabled={loadingSubscribe}
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 hover:bg-neutral-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingSubscribe ? 'Redirecting…' : 'Subscribe Now'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
