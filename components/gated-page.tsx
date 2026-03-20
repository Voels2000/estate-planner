'use client'

import { useState } from 'react'
import { UpgradeModal } from '@/components/upgrade-modal'
import { TIER_NAMES } from '@/lib/tiers'

type Props = {
  requiredTier: 1 | 2 | 3
  currentTier: number
  featureName: string
  children: React.ReactNode
}

export function GatedPage({ requiredTier, currentTier, featureName, children }: Props) {
  const [showModal, setShowModal] = useState(false)
  const tierName = TIER_NAMES[requiredTier]

  return (
    <div className="relative">
      {/* Blurred content preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="mx-4 w-full max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-200 p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-neutral-9 mb-2">
            {featureName}
          </h2>
          <p className="text-sm text-neutral-500 mb-6">
            This feature is available on the{' '}
            <span className="font-semibold text-neutral-700">{tierName} plan</span>{' '}
            and above.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition"
          >
            Upgrade to {tierName}
          </button>
          <p className="mt-3 text-xs text-neutral-400">
            You're currently on the {TIER_NAMES[currentTier as 1|2|3] ?? 'Financial'} plan
          </p>
        </div>
      </div>

      {showModal && (
        <UpgradeModal
          requiredTier={requiredTier}
          currentTier={currentTier}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
