import { scoreBg, scoreColor, scoreContextSentenceForAdvisor, scoreLabel } from '@/lib/estate-health-score'

type Props = {
  score: number | null
  computedAt: string | null
  clientName: string | null
}

export function PlanReadinessCard({ score, computedAt, clientName }: Props) {
  if (score === null) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400 mb-1">
          Plan Readiness
        </p>
        <p className="text-sm text-neutral-500">
          No readiness score yet.{' '}
          {clientName ? `${clientName} hasn't` : "Client hasn't"} completed
          enough of their profile to generate a score.
        </p>
      </div>
    )
  }

  const color = scoreColor(score)
  const bg = scoreBg(score)
  const label = scoreLabel(score)

  return (
    <div className={`rounded-xl border p-5 ${bg}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-semibold uppercase tracking-wide ${color}`}>
          Plan Readiness Score
        </p>
        {computedAt && (
          <p className="text-xs text-neutral-400">
            Updated{' '}
            {new Date(computedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </p>
        )}
      </div>

      <div className="flex items-end gap-3 mb-3">
        <span className={`text-4xl font-bold tabular-nums ${color}`}>{score}</span>
        <span className={`text-sm mb-1 ${color}`}>/ 100</span>
        <span className="mb-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-white/80 border border-neutral-200/80">
          {label}
        </span>
      </div>

      <div className="h-2 rounded-full bg-white/60 overflow-hidden mb-3">
        <div
          className={`h-full rounded-full transition-all ${score >= 75 ? 'bg-[color:var(--mwm-sage)]' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${score}%` }}
        />
      </div>

      <p className="text-xs leading-relaxed text-neutral-600">
        {scoreContextSentenceForAdvisor(score, clientName)}
      </p>
    </div>
  )
}
