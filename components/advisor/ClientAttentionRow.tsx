'use client'

import { HealthScoreBadge } from '@/components/shared/HealthScoreBadge'

type Props = {
  clientId: string
  clientName: string
  healthScore: number | null
  criticalAlertCount: number
}

export function ClientAttentionRow({
  clientId,
  clientName,
  healthScore,
  criticalAlertCount,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--mwm-navy)] truncate">{clientName}</p>
        <p className="text-xs text-red-600 mt-0.5">
          {healthScore != null && healthScore < 50 && 'Health score below 50'}
          {healthScore != null && healthScore < 50 && criticalAlertCount > 0 && ' · '}
          {criticalAlertCount > 0 &&
            `${criticalAlertCount} critical alert${criticalAlertCount > 1 ? 's' : ''}`}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {healthScore != null && (
          <HealthScoreBadge score={healthScore} size="badge" showLabel={false} />
        )}
        <a
          href={`/advisor/clients/${clientId}`}
          className="text-xs font-semibold text-[color:var(--mwm-navy)] underline"
        >
          Review →
        </a>
      </div>
    </div>
  )
}
