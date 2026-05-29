'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge'
import { isScoreStale, scoreContextSentence } from '@/lib/estate-health-score'

type Props = {
  score: number | null
  computedAt: string | null
}

export function MyEstateStrategyHealthScore({ score, computedAt }: Props) {
  const router = useRouter()
  const [recalculating, setRecalculating] = useState(false)

  if (score == null) return null

  async function handleRecompute() {
    setRecalculating(true)
    try {
      await fetch('/api/estate/refresh-conflicts', { method: 'POST' })
      router.refresh()
    } finally {
      setRecalculating(false)
    }
  }

  const stale = isScoreStale(computedAt)

  return (
    <div className="mb-6 rounded-xl border border-neutral-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-3">
        Estate Readiness Score
      </p>
      <HealthScoreBadge size="card" score={score} lastUpdated={computedAt} />
      <p className="text-sm text-neutral-600 mt-3">{scoreContextSentence(score)}</p>
      {stale && (
        <p className="text-xs text-amber-600 mt-2">
          Score is over 30 days old —
          <button
            type="button"
            onClick={() => void handleRecompute()}
            disabled={recalculating}
            className="underline ml-1 font-medium disabled:opacity-50"
          >
            {recalculating ? 'Recalculating…' : 'Recalculate'}
          </button>
        </p>
      )}
      <Link
        href="/health-check"
        className="mt-3 inline-block text-xs font-medium text-[color:var(--mwm-navy)] hover:underline"
      >
        Update health check →
      </Link>
    </div>
  )
}
