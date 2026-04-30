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
    Math.max(0, expiryTimestamp - Date.now())
  )

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, expiryTimestamp - Date.now())
      setTimeLeft(remaining)
      if (remaining === 0) {
        clearInterval(interval)
        router.push('/billing')
        router.refresh()
      }
    }, 60000) // update every minute
    return () => clearInterval(interval)
  }, [expiryTimestamp, router])

  const totalHours = Math.floor(timeLeft / (1000 * 60 * 60))
  const daysLeft = Math.floor(totalHours / 24)
  const hoursLeft = totalHours % 24
  const isUrgent = totalHours <= 24 // last day

  function formatTimeLeft() {
    if (daysLeft >= 2) return `${daysLeft} days`
    if (daysLeft === 1) return `1 day${hoursLeft > 0 ? ` ${hoursLeft}h` : ''}`
    if (hoursLeft > 1) return `${hoursLeft} hours`
    if (hoursLeft === 1) return 'less than 1 hour'
    return 'a few minutes'
  }

  return (
    <div className={`w-full px-4 py-2.5 text-sm font-medium text-center 
      flex items-center justify-center gap-4 transition-colors ${
      isUrgent
        ? 'bg-red-600 text-white'
        : 'bg-amber-500 text-white'
    }`}>
      <span>
        {isUrgent ? '⚠️' : '⏳'}{' '}
        Your 3-day free trial ends in{' '}
        <span className="font-bold">
          {formatTimeLeft()}
        </span>
        {' '}— subscribe to keep access.
      </span>
      <ButtonLink
        href="/billing"
        variant="secondary"
        size="sm"
        className={`rounded-full border-transparent px-3 py-1 
          text-xs font-semibold shadow-sm ${
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
