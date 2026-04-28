import type { AssetAllocationContext } from '@/components/AssetAllocationSummary'
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

export function buildAllocationContext(input: {
  profile: {
    current_age?: number | null
    risk_tolerance?: string | null
    retirement_age?: number | null
    marital_status?: string | null
    dependents?: number | null
  } | null
  household: {
    person1_birth_year?: number | null
    risk_tolerance?: string | null
    person1_retirement_age?: number | null
    has_spouse?: boolean | null
    filing_status?: string | null
  } | null
}): AssetAllocationContext {
  const { profile, household } = input
  return {
    currentAge: profile?.current_age ?? null,
    birthYear: household?.person1_birth_year ?? null,
    riskTolerance: household?.risk_tolerance ?? profile?.risk_tolerance ?? null,
    retirementAge: profile?.retirement_age ?? household?.person1_retirement_age ?? null,
    maritalStatus: profile?.marital_status ?? null,
    dependents: profile?.dependents ?? null,
    hasSpouse: household?.has_spouse ?? null,
    filingStatus: household?.filing_status != null ? String(household.filing_status) : null,
  }
}
