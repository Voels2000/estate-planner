'use client'

import { useState, useEffect } from 'react'
import { ButtonLink } from '@/components/ui/Button'
import { getConsumerPlanDisplay } from '@/lib/billing/stripePrices'

const ESTATE_TRIAL_DAYS = getConsumerPlanDisplay(3, 'monthly').trialDays

export function TrialBanner({ expiryTimestamp }: { expiryTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, expiryTimestamp - Date.now()))

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(Math.max(0, expiryTimestamp - Date.now()))
    }, 60_000)
    return () => clearInterval(interval)
  }, [expiryTimestamp])

  const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24))
  const isUrgent = daysLeft <= 3

  const label =
    daysLeft <= 0
      ? 'Your Estate trial ends today'
      : daysLeft === 1
        ? 'Your Estate trial ends tomorrow'
        : `Your ${ESTATE_TRIAL_DAYS}-day Estate trial ends in ${daysLeft} days`

  return (
    <div
      className={`flex w-full items-center justify-center gap-4 px-4 py-2.5 text-center text-sm font-medium transition-colors ${
        isUrgent ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      <span>
        {isUrgent ? '⚠️' : '⏳'} {label} — subscribe to keep Estate access.
      </span>
      <ButtonLink
        href="/billing?plan=estate"
        variant="outline"
        size="sm"
        className={`rounded-full border-transparent px-3 py-1 text-xs font-semibold shadow-sm ${
          isUrgent
            ? 'bg-white text-red-600 hover:bg-red-50'
            : 'bg-white text-amber-700 hover:bg-amber-50'
        }`}
      >
        Choose a plan →
      </ButtonLink>
    </div>
  )
}
