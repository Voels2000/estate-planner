'use client'

import { useState } from 'react'
import { TIER_NAMES, TIER_PRICES, TIER_FEATURES } from '@/lib/tiers'

type Props = {
  requiredTier: 1 | 2 | 3
  currentTier: number
  onClose: () => void
}

export function UpgradeModal({ requiredTier, currentTier, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tierName = TIER_NAMES[requiredTier]
  const tierPrice = TIER_PRICES[requiredTier]
  const features = TIER_FEATURES[requiredTier]

  const PRICE_IDS: Record<number, string> = {
    1: 'price_1TILBRCaljka9gJt6dr44Znq',
    2: 'price_1TILEXCaljka9gJtrHqnG3bl',
    3: 'price_1TILGOCaljka9gJtCDLiKFHp',
  }

  async function handleUpgrade() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: PRICE_IDS[requiredTier] }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setLoading(false); return }
      window.location.href = data.url
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="bg-neutral-900 px-6 py-5 text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
              Upgrade Required
            </span>
            <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white">✕</button>
        </div>
          <h2 className="text-xl font-bold">
            {tierName} Plan
          </h2>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-bold">${tierPrice}</span>
            <span className="text-neutral-400 text-sm">/month</span>
          </div>
        </div>

        {/* Features */}
        <div className="px-6 py-5">
          <p className="text-sm font-medium text-neutral-700 mb-3">
            Unlock with the {tierName} plan:
          </p>
          <ul className="space-y-2 mb-5">
            {features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm text-neutral-600">
                <span className="text-indigo-600 font-bold">✓</span>
                {f}
              </li>
            ))}
          </ul>

          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? 'Redirecting to checkout...' : 'Upgrade to ' + tierName + ' — $' + tierPrice + '/mo'}
          </button>

          <button
            onClick={onClose}
            className="mt-3 w-full rounded-lg border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition"
          >
            Maybe later
          </button>

          {currentTier > 0 && (
            <p className="mt-3 text-xs text-center text-neutral-400">
              You&apos;re currently on the {TIER_NAMES[currentTier as 1|2|3] ?? 'Financial'} plan
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
