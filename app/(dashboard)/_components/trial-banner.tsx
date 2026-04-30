'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ButtonLink } from '@/components/ui/Button'

export function TrialBanner({
  expiryTimestamp,
}: {
  secondsLeft: number
  minutesLeft: number
  expiryTimestamp: number
}) {
  const router = useRouter()
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.ceil((expiryTimestamp - Date.now()) / 1000))
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiryTimestamp - Date.now()) / 1000))
      setTimeLeft(remaining)

      if (remaining === 0) {
        clearInterval(interval)
        router.push('/billing')
        router.refresh()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [expiryTimestamp, router])

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isUrgent = timeLeft <= 60

  return (
    <div className={`w-full px-4 py-2.5 text-sm font-medium text-center flex items-center justify-center gap-4 transition-colors ${
      isUrgent
        ? 'bg-red-600 text-white'
        : 'bg-amber-500 text-white'
    }`}>
      <span>
        {isUrgent ? '⚠️' : '⏳'}{' '}
        Your free trial ends in{' '}
        <span className="font-bold tabular-nums">
          {minutes}:{seconds.toString().padStart(2, '0')}
        </span>
        {' '}— subscribe to keep access.
      </span>
      <ButtonLink
        href="/billing"
        variant="secondary"
        size="sm"
        className={`rounded-full border-transparent px-3 py-1 text-xs font-semibold shadow-sm ${
          isUrgent
            ? 'bg-white text-red-600 hover:bg-red-50'
            : 'bg-white text-amber-700 hover:bg-amber-50'
        }`}
      >
        Subscribe now →
      </ButtonLink>
    </div>
  )
}
