'use client'

import { scoreBg, scoreColor, scoreLabel } from '@/lib/estate-health-score'

type ScoreSize = 'hero' | 'card' | 'badge'

interface HealthScoreBadgeProps {
  score: number | null
  size?: ScoreSize
  showLabel?: boolean
  showDelta?: boolean
  delta?: number | null
  lastUpdated?: string | null
  className?: string
}

export function HealthScoreBadge({
  score,
  size = 'card',
  showLabel = true,
  showDelta = false,
  delta = null,
  lastUpdated = null,
  className = '',
}: HealthScoreBadgeProps) {
  if (score == null) {
    return (
      <div className={`text-neutral-400 text-sm ${className}`}>
        Score not yet calculated
      </div>
    )
  }

  const color = scoreColor(score)
  const bg = scoreBg(score)
  const label = scoreLabel(score)

  if (size === 'hero') {
    return (
      <div className={`rounded-xl border p-5 ${bg} ${className}`}>
        <div className="flex items-end gap-3">
          <span className={`text-5xl font-bold tabular-nums ${color}`}>{score}</span>
          <span className="text-neutral-500 text-lg mb-1">/100</span>
          {showDelta && delta != null && (
            <span
              className={`text-sm font-medium mb-1.5 ${
                delta >= 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {delta >= 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`}
            </span>
          )}
        </div>
        {showLabel && <p className={`text-sm font-semibold mt-1 ${color}`}>{label}</p>}
        {lastUpdated && (
          <p className="text-xs text-neutral-400 mt-1">
            Updated{' '}
            {new Date(lastUpdated).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>
    )
  }

  if (size === 'badge') {
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
          score >= 75
            ? 'bg-[var(--mwm-sage-pale)] text-[color:var(--mwm-sage)]'
            : score >= 50
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
        } ${className}`}
      >
        {score}
        {showLabel && <span className="font-normal">· {label}</span>}
      </span>
    )
  }

  return (
    <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${bg} ${className}`}>
      <span className={`text-3xl font-bold tabular-nums ${color}`}>{score}</span>
      <div>
        <p className="text-xs text-neutral-500">/ 100</p>
        {showLabel && <p className={`text-xs font-semibold ${color}`}>{label}</p>}
      </div>
      {showDelta && delta != null && (
        <span
          className={`ml-auto text-xs font-medium ${
            delta >= 0 ? 'text-emerald-600' : 'text-red-500'
          }`}
        >
          {delta >= 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`} since last review
        </span>
      )}
      {lastUpdated && !showDelta && (
        <p className="ml-auto text-xs text-neutral-400">
          {new Date(lastUpdated).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
