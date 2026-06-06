import type { Conflict, ConflictReport } from '@/lib/conflict-detector'
import type { EstateHealthScore } from '@/lib/estate-health-score'

type HealthComponentLike = {
  label?: string
  score?: number
  maxScore?: number
  actionLabel?: string
  actionHref?: string
}

export function mapEstateHealthScore(
  healthScoreRow:
    | {
        score?: number | null
        component_scores?: Record<string, unknown> | null
        computed_at?: string | null
      }
    | null
    | undefined,
): EstateHealthScore | null {
  if (!healthScoreRow) return null
  return {
    score: healthScoreRow.score ?? 0,
    components: Object.entries(healthScoreRow.component_scores ?? {}).map(
      ([key, rawVal]: [string, unknown]) => {
        const val: HealthComponentLike =
          rawVal && typeof rawVal === 'object' ? (rawVal as HealthComponentLike) : {}
        return {
          key,
          label: val.label ?? key,
          score: val.score ?? 0,
          maxScore: val.maxScore ?? 0,
          status:
            (val.score ?? 0) >= (val.maxScore ?? 1)
              ? 'good'
              : (val.score ?? 0) >= (val.maxScore ?? 1) * 0.5
                ? 'warning'
                : 'critical',
          actionLabel: val.actionLabel ?? '',
          actionHref: val.actionHref ?? '/health-check',
        }
      },
    ),
    computedAt: healthScoreRow.computed_at ?? new Date().toISOString(),
  }
}

export function mapConflictReport(
  conflictRows: Conflict[] | null | undefined,
): ConflictReport | null {
  if (!conflictRows) return null
  return {
    conflicts: conflictRows,
    critical: conflictRows.filter((c) => c.severity === 'critical').length,
    warnings: conflictRows.filter((c) => c.severity === 'warning').length,
    computedAt: new Date().toISOString(),
  }
}
