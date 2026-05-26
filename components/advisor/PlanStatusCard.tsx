type PlanStatus = 'critical' | 'needs-attention' | 'on-track'

type Props = {
  score: number | null
  status: PlanStatus
  criticalGaps: number
  highGaps: number
  clientName: string | null
  lastUpdated: string | null
}

function scoreToStatus(score: number | null, criticalGaps: number): PlanStatus {
  if (criticalGaps > 0) return 'critical'
  if (score === null) return 'needs-attention'
  if (score >= 70) return 'on-track'
  return 'needs-attention'
}

export function PlanStatusCard({
  score,
  status: statusProp,
  criticalGaps,
  highGaps,
  clientName,
  lastUpdated,
}: Props) {
  const status = statusProp ?? scoreToStatus(score, criticalGaps)
  const displayScore = score ?? '—'

  const statusStyles = {
    critical: {
      card: 'border-red-200 bg-red-50',
      score: 'text-red-600',
      bar: 'bg-red-500',
    },
    'needs-attention': {
      card: 'border-amber-200 bg-amber-50',
      score: 'text-amber-600',
      bar: 'bg-amber-500',
    },
    'on-track': {
      card: 'border-green-200 bg-green-50',
      score: 'text-green-600',
      bar: 'bg-green-500',
    },
  }[status]

  const barWidth = typeof score === 'number' ? Math.min(100, Math.max(0, score)) : 0

  return (
    <div className={`rounded-xl border-2 p-6 ${statusStyles.card}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
            Plan Readiness Score
            {clientName ? ` · ${clientName}` : ''}
          </p>
          <div className="flex items-baseline gap-2">
            <span className={`text-5xl font-bold ${statusStyles.score}`}>{displayScore}</span>
            {typeof score === 'number' && <span className="text-lg text-gray-400">/100</span>}
          </div>
          {lastUpdated && (
            <p className="text-sm text-gray-600 mt-1">Updated {lastUpdated}</p>
          )}
        </div>

        <div className="text-left sm:text-right">
          {criticalGaps > 0 && (
            <div className="flex items-center gap-2 sm:justify-end mb-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" />
              <span className="text-sm font-semibold text-red-700">
                {criticalGaps} critical gap{criticalGaps > 1 ? 's' : ''} — review below
              </span>
            </div>
          )}
          {highGaps > 0 && (
            <div className="flex items-center gap-2 sm:justify-end">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-sm text-amber-700">
                {highGaps} high-priority gap{highGaps > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {criticalGaps === 0 && highGaps === 0 && typeof score === 'number' && (
            <p className="text-sm text-green-700 font-medium">No open critical gaps</p>
          )}
        </div>
      </div>

      {typeof score === 'number' && (
        <div className="mt-4 h-2 rounded-full bg-white/60">
          <div
            className={`h-2 rounded-full transition-all ${statusStyles.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}
    </div>
  )
}

export { scoreToStatus }
