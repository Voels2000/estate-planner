'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import {
  isScoreStale,
  scoreColor,
  scoreContextSentence,
  scoreLabel,
} from '@/lib/estate-health-score'
import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge'

type Props = {
  estateHealthScore: EstateHealthScore
  componentsGrid: ReactNode
  updateHref?: string
}

export function EstateHealthScoreBlock({
  estateHealthScore,
  componentsGrid,
  updateHref = '/health-check',
}: Props) {
  const router = useRouter()
  const [recalculating, setRecalculating] = useState(false)

  async function handleRecompute() {
    setRecalculating(true)
    try {
      await fetch('/api/estate/refresh-conflicts', { method: 'POST' })
      router.refresh()
    } finally {
      setRecalculating(false)
    }
  }

  const stale = isScoreStale(estateHealthScore.computedAt)

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
            Estate Readiness Score
          </p>
          <HealthScoreBadge
            size="hero"
            score={estateHealthScore.score}
            lastUpdated={estateHealthScore.computedAt}
            className="border"
          />
          <p className="text-sm text-neutral-600 mt-3 max-w-xl">
            {scoreContextSentence(estateHealthScore.score)}
          </p>
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
        </div>
        <Link
          href={updateHref}
          className="shrink-0 rounded-lg bg-white border border-neutral-200 px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition shadow-sm"
        >
          Update health check →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{componentsGrid}</div>
    </div>
  )
}

/** Inline badge for collapsible section header */
export function EstateHealthScoreHeaderBadge({ score }: { score: number }) {
  return (
    <span
      className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(score)} bg-neutral-100`}
    >
      {score}/100 · {scoreLabel(score)}
    </span>
  )
}
