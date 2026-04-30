'use client'

import { useState } from 'react'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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
  isAdvisorClient: boolean
}

export function BillingClient({
  plans,
  currentPlan,
  subscriptionStatus,
  isAdvisorClient,
}: Props) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubscribe(priceId: string) {
    setError(null)
    setLoadingPriceId(priceId)
    try {
      // FIX: pass returnTo from URL params so post-payment lands back on the
      // gated page the user came from rather than always going to /dashboard
      const params = new URLSearchParams(window.location.search)
      const returnTo = params.get('returnTo') ?? undefined
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, ...(returnTo ? { returnTo } : {}) }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoadingPriceId(null); return }
      window.location.assign(data.url)
    } catch { setError('Something went wrong. Please try again.'); setLoadingPriceId(null) }
  }

  async function handleManageSubscription() {
    setError(null)
    setLoadingPriceId('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoadingPriceId(null); return }
      window.location.assign(data.url)
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

  if (isAdvisorClient) {
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <Card className="p-8">
          <div className="mb-4 text-4xl">🎉</div>
          <h1 className="text-2xl font-bold text-neutral-900">You&apos;re all set</h1>
          <p className="mt-3 text-neutral-600">
            Your plan is managed by your advisor. There&apos;s nothing to do here.
          </p>
          <div className="mt-8">
            <ButtonLink href="/dashboard" variant="link" className="text-sm font-medium">
              ← Back to Dashboard
            </ButtonLink>
          </div>
        </Card>
      </div>
    )
  }

  // ── Consumer billing view ─────────────────────────────────────────────────
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
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Choose your plan</h1>
        <p className="mt-3 text-neutral-600">Start planning your estate and retirement today.</p>
        {isActive && (
          <p className="mt-2 text-sm text-green-600 font-medium">
            You are currently on the {plans.find(p => p.priceId === currentPlan)?.name ?? currentPlan} plan
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
          const isCurrentPlan = currentPlan === plan.priceId
          return (
            <Card
              key={plan.priceId}
              hover={!plan.highlighted}
              className={`relative rounded-2xl p-8 shadow-md ring-1 ${
                plan.highlighted
                  ? 'border-neutral-900 bg-neutral-900 ring-neutral-900'
                  : 'ring-neutral-200'
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
              <Button
                type="button"
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loadingPriceId === plan.priceId || isCurrentPlan}
                variant={plan.highlighted ? 'primary' : 'dark'}
                className="mt-8 w-full rounded-lg py-2.5 text-sm font-medium"
              >
                {isCurrentPlan && isActive ? 'Current Plan' : loadingPriceId === plan.priceId ? 'Redirecting...' : 'Get started'}
              </Button>
            </Card>
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
