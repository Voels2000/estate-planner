'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ATTORNEY_PLAN_LIMITS, ATTORNEY_PLAN_NAMES, type AttorneyPlanKey } from '@/lib/tiers'
import { ATTORNEY_TIER_LIMITS } from '@/lib/attorney/attorneyTierLimits'

function planPriceLabel(plan: Plan): string {
  if (plan.id === 0) return '$0'
  if (plan.planKey) return `$${ATTORNEY_PLAN_LIMITS[plan.planKey].priceMonthly}/mo`
  return plan.price
}

type Plan = {
  id: number
  planKey?: AttorneyPlanKey
  name: string
  price: string
  features: string[]
  envKey?: string
}

type Props = {
  currentTier: number
  plans: Plan[]
  checkoutSuccess?: boolean
  canceled?: boolean
}

export function AttorneyBillingClient({
  currentTier,
  plans,
  checkoutSuccess = false,
  canceled = false,
}: Props) {
  const [loading, setLoading] = useState<AttorneyPlanKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(planKey: AttorneyPlanKey) {
    setLoading(planKey)
    setError(null)
    try {
      const res = await fetch('/api/stripe/attorney-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Checkout failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  const successPlanName =
    currentTier === 2
      ? ATTORNEY_PLAN_NAMES.growth
      : currentTier === 1
        ? ATTORNEY_PLAN_NAMES.starter
        : 'paid'

  return (
    <div className="mx-auto max-w-4xl p-6">
      <Link href="/attorney" className="text-sm text-neutral-400 hover:text-neutral-600">
        ← Back to portal
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-neutral-900">Attorney Plans</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Current plan: <strong>{ATTORNEY_TIER_LIMITS[currentTier]?.label ?? 'Free'}</strong>
      </p>

      {checkoutSuccess && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          You&apos;re now on the {successPlanName} plan. Your client cap and features have been
          updated.
        </div>
      )}

      {canceled && (
        <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          Checkout was canceled. You can try again when ready.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-5 ${
              currentTier === plan.id ? 'border-blue-400 bg-blue-50/50' : 'border-neutral-200 bg-white'
            }`}
          >
            <h2 className="font-semibold text-neutral-900">{plan.name}</h2>
            <p className="mt-1 text-lg font-bold text-neutral-800">{planPriceLabel(plan)}</p>
            <ul className="mt-4 space-y-2 text-xs text-neutral-600">
              {plan.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {plan.id > currentTier && plan.planKey ? (
              <button
                type="button"
                onClick={() => void handleSubscribe(plan.planKey!)}
                disabled={loading !== null}
                className="mt-4 w-full rounded-md bg-[color:var(--mwm-navy)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading === plan.planKey ? 'Redirecting…' : `Subscribe to ${plan.name}`}
              </button>
            ) : null}
            {plan.id > currentTier && plan.envKey && !plan.planKey ? (
              <p className="mt-4 rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                TODO: Set {plan.envKey} in Stripe — contact support to activate checkout.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
