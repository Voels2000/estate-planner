'use client'

import { useState } from 'react'

const PLANS = [
  {
    name: 'Consumer Plan',
    price: '$9',
    period: 'per month',
    priceId: 'price_1TAlJjCaljka9gJthGTMogQb',
    description: 'Perfect for individuals managing their own estate planning.',
    features: [
      'Assets & liabilities tracking',
      'Income & expense management',
      'Retirement projections',
      'Scenario planning',
      'Dashboard & reports',
    ],
    highlighted: false,
  },
  {
    name: 'Advisor Plan',
    price: '$49',
    period: 'per month',
    priceId: 'price_1TAlRkCaljka9gJtL7jcTwWY',
    description: 'For financial advisors managing multiple clients.',
    features: [
      'Everything in Consumer',
      'Advisor portal',
      'Multiple client accounts',
      'Client sharing & collaboration',
      'Priority support',
    ],
    highlighted: true,
  },
]

export default function BillingPage() {
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

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoadingPriceId(null)
        return
      }

      window.location.href = data.url
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoadingPriceId(null)
    }
  }

  async function handleManageSubscription() {
    setError(null)
    setLoadingPriceId('portal')

    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        setLoadingPriceId(null)
        return
      }

      window.location.href = data.url
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setLoadingPriceId(null)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Choose your plan
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400">
          Start planning your estate and retirement today.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400 text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.priceId}
            className={`relative rounded-2xl p-8 shadow-sm ring-1 ${
              plan.highlighted
                ? 'bg-zinc-900 ring-zinc-900 dark:bg-zinc-50'
                : 'bg-white ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-700'
            }`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">
                Most Popular
              </span>
            )}

            <h2 className={`text-lg font-semibold ${
              plan.highlighted ? 'text-zinc-50 dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-50'
            }`}>
              {plan.name}
            </h2>

            <p className={`mt-1 text-sm ${
              plan.highlighted ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
            }`}>
              {plan.description}
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className={`text-4xl font-bold ${
                plan.highlighted ? 'text-zinc-50 dark:text-zinc-900' : 'text-zinc-900 dark:text-zinc-50'
              }`}>
                {plan.price}
              </span>
              <span className={`text-sm ${
                plan.highlighted ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
              }`}>
                {plan.period}
              </span>
            </div>

            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <span className={`text-lg leading-none ${
                    plan.highlighted ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>✓</span>
                  <span className={
                    plan.highlighted ? 'text-zinc-300 dark:text-zinc-700' : 'text-zinc-600 dark:text-zinc-300'
                  }>
                    {feature}
                  </span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan.priceId)}
              disabled={loadingPriceId === plan.priceId}
              className={`mt-8 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-70 ${
                plan.highlighted
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                  : 'bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200'
              }`}
            >
              {loadingPriceId === plan.priceId ? 'Redirecting...' : 'Get started'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleManageSubscription}
          disabled={loadingPriceId === 'portal'}
          className="text-sm text-zinc-500 hover:text-zinc-700 underline-offset-4 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200 disabled:opacity-50"
        >
          {loadingPriceId === 'portal' ? 'Loading...' : 'Manage existing subscription'}
        </button>
      </div>
    </div>
  )
}
