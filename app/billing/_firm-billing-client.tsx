'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ADVISOR_FIRM_SEAT_RANGES } from '@/lib/tiers'

const TIER_LABEL: Record<string, string> = {
  starter: `Starter (${ADVISOR_FIRM_SEAT_RANGES.starter.label})`,
  growth: `Growth (${ADVISOR_FIRM_SEAT_RANGES.growth.label})`,
  enterprise: `Enterprise (${ADVISOR_FIRM_SEAT_RANGES.enterprise.label})`,
}

const TIER_MAX_SEATS: Record<string, number> = {
  starter: 10,
  growth: 50,
  enterprise: 250,
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
  seatCount: initialSeatCount,
  totalMonthly: initialTotalMonthly,
  subscriptionStatus,
  firmCheckoutPriceId,
}: Props) {
  const maxSeats = TIER_MAX_SEATS[firmTierKey] ?? 10
  const [seatCountInput, setSeatCountInput] = useState(
    Math.min(Math.max(1, initialSeatCount || 1), maxSeats),
  )
  const [loadingSubscribe, setLoadingSubscribe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive =
    subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
  const effectiveSeats = Math.min(Math.max(1, seatCountInput || 1), maxSeats)
  const displaySeats = isActive ? initialSeatCount : effectiveSeats
  const totalMonthly = perSeatRate * displaySeats

  async function handleFirmCheckout() {
    setError(null)
    setLoadingSubscribe(true)
    try {
      const res = await fetch('/api/stripe/firm-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: firmCheckoutPriceId,
          seatCount: effectiveSeats,
        }),
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
        <ButtonLink
          href="/dashboard"
          variant="link"
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          ← Back to Dashboard
        </ButtonLink>
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

      <Card className="space-y-6 rounded-2xl p-6">
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
            <p className="mt-1 text-neutral-900">{displaySeats}</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-neutral-500">
              Total monthly charge
            </h3>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              ${totalMonthly.toLocaleString('en-US')}/mo
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {perSeatRate} × {displaySeats} seats
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          {isActive && (
            <ButtonLink href="/advisor/firm" variant="dark" className="rounded-lg px-4 py-2.5 text-sm">
              Manage Subscription
            </ButtonLink>
          )}
          {!isActive && (
            <>
              <div className="w-full">
                <label
                  htmlFor="firm-billing-seats"
                  className="block text-sm font-medium text-neutral-700 mb-1.5"
                >
                  Number of advisor seats
                </label>
                <input
                  id="firm-billing-seats"
                  type="number"
                  min={1}
                  max={maxSeats}
                  value={seatCountInput}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setSeatCountInput(Number.isNaN(parsed) ? 1 : parsed)
                  }}
                  className="w-full max-w-xs rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                />
                <p className="mt-2 text-sm font-semibold text-neutral-900">
                  Total: ${totalMonthly.toLocaleString('en-US')}/month
                </p>
              </div>
              <p className="w-full text-sm text-neutral-700 leading-relaxed">
                {BILLING_DISCLOSURES.preCheckout(
                  resolvedTierLabel,
                  `$${totalMonthly.toLocaleString('en-US')}`,
                  'month',
                )}
              </p>
              <Button
              type="button"
              onClick={handleFirmCheckout}
              disabled={loadingSubscribe}
              variant="secondary"
              className="rounded-lg px-4 py-2.5 text-sm"
            >
              {loadingSubscribe ? 'Redirecting…' : 'Subscribe Now'}
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
