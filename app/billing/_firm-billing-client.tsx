'use client'

import { useState } from 'react'
import { BILLING_DISCLOSURES } from '@/lib/compliance/billing-disclosures'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ADVISOR_FIRM_SEAT_RANGES } from '@/lib/tiers'
import { getFirmTierMaxSeats } from '@/lib/firm/firmRoster'

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

const TIER_MIN_SEATS: Record<string, number> = {
  starter: 1,
  growth: 11,
  enterprise: 51,
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
  const minSeats = TIER_MIN_SEATS[firmTierKey] ?? 1
  const [seatCountInput, setSeatCountInput] = useState(
    Math.min(Math.max(minSeats, initialSeatCount || minSeats), maxSeats),
  )
  const [loadingSubscribe, setLoadingSubscribe] = useState(false)
  const [loadingPortal, setLoadingPortal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isActive =
    subscriptionStatus === 'active' || subscriptionStatus === 'trialing'
  const tierMaxSeats = getFirmTierMaxSeats(firmTierKey)
  const atTierSeatCap = isActive && initialSeatCount >= tierMaxSeats
  const canUpgradeTier = atTierSeatCap && firmTierKey === 'starter'
  const effectiveSeats = Math.min(Math.max(minSeats, seatCountInput || minSeats), maxSeats)
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

  async function handleManageBilling() {
    setError(null)
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(
          typeof data.error === 'string'
            ? data.error
            : 'Something went wrong. Please try again.',
        )
        setLoadingPortal(false)
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
      setLoadingPortal(false)
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

      {canUpgradeTier && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You&apos;ve reached the Starter plan limit ({tierMaxSeats} seats). Upgrade to Growth (
          {ADVISOR_FIRM_SEAT_RANGES.growth.label}) via Manage firm billing to add more advisors.
          <button
            type="button"
            onClick={() => void handleManageBilling()}
            disabled={loadingPortal}
            className="ml-2 font-medium underline underline-offset-2 hover:text-amber-950 disabled:opacity-50"
          >
            Upgrade in Stripe
          </button>
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
            <>
              <Button
                type="button"
                onClick={() => void handleManageBilling()}
                disabled={loadingPortal}
                variant="dark"
                className="rounded-lg px-4 py-2.5 text-sm"
              >
                {loadingPortal ? 'Loading…' : 'Manage firm billing'}
              </Button>
              <ButtonLink href="/advisor/firm" variant="secondary" className="rounded-lg px-4 py-2.5 text-sm">
                Manage firm roster
              </ButtonLink>
            </>
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
                  min={minSeats}
                  max={maxSeats}
                  value={seatCountInput}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10)
                    setSeatCountInput(Number.isNaN(parsed) ? minSeats : parsed)
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
