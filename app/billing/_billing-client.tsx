`'use client'

import { useState } from 'react'

type AdvisorTier = {
  id: string
  name: string
  stripe_price_id: string
  price_monthly: number
  client_limit: number | null
  display_order: number
  is_active: boolean
}

type AdvisorTierInfo = {
  tiers: AdvisorTier[]
  currentTier: AdvisorTier | null
}

type Plan = {
  priceId: string
  name: string
  description: string
  features: string[]
  amount: number
  currency: string
  interval: string
  highlighted: boolean
}

type Props = {
  plans: Plan[]
  currentPlan: string | null
  subscriptionStatus: string | null
  isAdvisor: boolean
  advisorTier: AdvisorTierInfo | null
  advisorClientCount: number
}

export function BillingClient({
  plans,
  currentPlan,
  subscriptionStatus,
  isAdvisor,
  advisorTier,
  advisorClientCount,
}: Props) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(priceId: string) {
    setError(null)
    setLoadingPriceId(priceId)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoadingPriceId(null); return }
      window.location.href = data.url
    } catch { setError('Something went wrong. Please try again.'); setLoadingPriceId(null) }
  }

  async function handleManageSubscription() {
    setError(null)
    setLoadingPriceId('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoadingPriceId(null); return }
      window.location.href = data.url
    } catch { setError('Something went wrong. Please try again.'); setLoadingPriceId(null) }
  }

  function formatPrice(amount: number, currency: string, interval: string) {
    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency', currency: currency.toUpperCase(),
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(amount / 100)
    return { price: formatted, period: `per ${interval}` }
  }

  const isActive = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

  // ── Advisor billing view ──────────────────────────────────────────────────
  if (isAdvisor && advisorTier) {
    const { tiers, currentTier } = advisorTier
    const limit = currentTier?.client_limit ?? null
    const atLimit = limit !== null && advisorClientCount >= limit
    const usagePct = limit ? Math.min(100, Math.round((advisorClientCount / limit) * 100)) : 0

    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-6">
          <a href="/dashboard" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
            ← Back to Dashboard
          </a>
        </div>
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Advisor Billing</h1>
          <p className="mt-2 text-neutral-600">Manage your advisor plan and client capacity.</p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Current usage card */}
        <div className="mb-8 rounded-2xl bg-white border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
              Current Plan — {currentTier?.name ?? 'Advisor'}
            </h2>
            <span className="text-sm font-medium text-neutral-900">
              ${currentTier?.price_monthly ?? 159}/month
            </span>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-neutral-600">Clients</span>
              <span className={`font-medium ${atLimit ? 'text-red-600' : 'text-neutral-900'}`}>
                {advisorClientCount} / {limit ?? '∞'}
              </span>
            </div>
            {limit && (
              <div className="w-full bg-neutral-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${atLimit ? 'bg-red-500' : 'bg-emerald-500'}`}
                  style={{ width: `${usagePct}%` }}
                />
              </div>
            )}
            {atLimit && (
              <p className="mt-2 text-xs text-red-600">
                You've reached your client limit. Upgrade to add more clients.
              </p>
            )}
          </div>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const isCurrent = currentTier?.id === tier.id
            const isPlaceholder = tier.stripe_price_id.startsWith('price_PLACEHOLDER')

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl p-6 shadow-sm ring-1 ${
                  isCurrent
                    ? 'bg-neutral-900 ring-neutral-900'
                    : 'bg-white ring-neutral-200'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                    Current Plan
                  </span>
                )}
                <h3 className={`font-semibold ${isCurrent ? 'text-white' : 'text-neutral-900'}`}>
                  {tier.name}
                </h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={`text-3xl font-bold ${isCurrent ? 'text-white' : 'text-neutral-900'}`}>
                    ${tier.price_monthly}
                  </span>
                  <span className={`text-sm ${isCurrent ? 'text-neutral-400' : 'text-neutral-500'}`}>
                    /month
                  </span>
                </div>
                <p className={`mt-1 text-sm ${isCurrent ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {tier.client_limit ? `Up to ${tier.client_limit} clients` : 'Unlimited clients'}
                </p>
                <button
                  onClick={() => handleSubscribe(tier.stripe_price_id)}
                  disabled={isCurrent || loadingPriceId === tier.stripe_price_id || isPlaceholder}
                  className={`mt-6 w-full rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    isCurrent
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-900 text-white hover:bg-neutral-800'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : isPlaceholder ? 'Coming Soon' : loadingPriceId === tier.stripe_price_id ? 'Redirecting...' : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={handleManageSubscription}
            disabled={loadingPriceId === 'portal'}
            className="text-sm text-neutral-500 hover:text-neutral-700 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {loadingPriceId === 'portal' ? 'Loading...' : 'Manage existing subscription'}
          </button>
        </div>
      </div>
    )
  }

  // ── Consumer billing view ─────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-6">
        <a href="/dashboard" className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-900 transition-colors">
          ← Back to Dashboard
        </a>
      </div>
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Choose your plan</h1>
        <p className="mt-3 text-neutral-600">Start planning your estate and retirement today.</p>
        {isActive && (
          <p className="mt-2 text-sm text-green-600 font-medium">
            You are currently on the {currentPlan} plan
          </p>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map((plan) => {
          const { price, period } = formatPrice(plan.amount, plan.currency, plan.interval)
          const isCurrentPlan = currentPlan === plan.name.toLowerCase()
          return (
            <div
              key={plan.priceId}
              className={`relative rounded-2xl p-8 shadow-sm ring-1 ${
                plan.highlighted ? 'bg-neutral-900 ring-neutral-900' : 'bg-white ring-neutral-200'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                  Most Popular
                </span>
              )}
              {isCurrentPlan && isActive && (
                <span className="absolute -top-3 right-6 rounded-full bg-green-500 px-3 py-1 text-xs font-medium text-white">
                  Current Plan
                </span>
              )}
              <h2 className={`text-lg font-semibold ${plan.highlighted ? 'text-white' : 'text-neutral-900'}`}>
                {plan.name}
              </h2>
              <p className={`mt-1 text-sm ${plan.highlighted ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {plan.description}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-neutral-900'}`}>
                  {price}
                </span>
                <span className={`text-sm ${plan.highlighted ? 'text-neutral-400' : 'text-neutral-500'}`}>
                  {period}
                </span>
              </div>
              {plan.features.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <span className={`text-lg leading-none ${plan.highlighted ? 'text-indigo-400' : 'text-indigo-600'}`}>✓</span>
                      <span className={plan.highlighted ? 'text-neutral-300' : 'text-neutral-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loadingPriceId === plan.priceId || isCurrentPlan}
                className={`mt-8 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  plan.highlighted ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-neutral-900 text-white hover:bg-neutral-800'
                }`}
              >
                {isCurrentPlan && isActive ? 'Current Plan' : loadingPriceId === plan.priceId ? 'Redirecting...' : 'Get started'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleManageSubscription}
          disabled={loadingPriceId === 'portal'}
          className="text-sm text-neutral-500 hover:text-neutral-700 underline-offset-4 hover:underline disabled:opacity-50"
        >
          {loadingPriceId === 'portal' ? 'Loading...' : 'Manage existing subscription'}
        </button>
      </div>
    </div>
  )
}
