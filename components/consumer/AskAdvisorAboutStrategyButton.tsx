'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  strategyName: string
  strategyType: string
}

export function AskAdvisorAboutStrategyButton({ strategyName, strategyType }: Props) {
  const router = useRouter()
  const [askingAdvisor, setAskingAdvisor] = useState<string | null>(null)
  const [advisorAsked, setAdvisorAsked] = useState<Set<string>>(() => new Set())

  async function handleAskAdvisor() {
    setAskingAdvisor(strategyType)
    try {
      const res = await fetch('/api/consumer/ask-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_name: strategyName,
          strategy_type: strategyType,
        }),
      })
      const data = (await res.json()) as { hasAdvisor?: boolean }
      if (data.hasAdvisor) {
        setAdvisorAsked((prev) => new Set([...prev, strategyType]))
      } else {
        router.push('/find-advisor')
      }
    } catch {
      router.push('/find-advisor')
    } finally {
      setAskingAdvisor(null)
    }
  }

  if (advisorAsked.has(strategyType)) {
    return (
      <span className="mt-1 flex items-center gap-1.5 text-sm text-[color:var(--mwm-sage)]">
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Your advisor has been notified
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => void handleAskAdvisor()}
      disabled={askingAdvisor === strategyType}
      className="mt-1 text-sm text-[color:var(--mwm-navy)] underline underline-offset-2 transition-colors hover:text-[color:var(--mwm-navy-light)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {askingAdvisor === strategyType ? 'Notifying your advisor…' : 'Ask your advisor about this →'}
    </button>
  )
}
