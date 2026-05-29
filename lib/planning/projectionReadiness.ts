/**
 * Projection page readiness — replaces the binary `projections.length === 0` empty state.
 *
 * Phase 1 audit (2026-05-27):
 * - `/projections` server component calls `loadProjectionData` on every render (no layout cache).
 * - Empty state was triggered client-side when `projections.length === 0`, with a generic
 *   "Complete your profile" CTA (`PLANNING_MISSING_PROJECTION_ACTIONS_TIER2`).
 * - `/scenarios` inline prompts PATCH retirement/longevity/deduction fields via
 *   `ProfileFieldPrompt` → `PATCH /api/consumer/profile`; those values are persisted and
 *   visible on the next server fetch — not a sessionStorage staleness issue.
 * - `computeCompleteProjection` can still return zero rows when the planning horizon has
 *   already ended (`person1_birth_year + person1_longevity_age < currentYear`), or when
 *   birth year is unset while the user only added assets/income elsewhere.
 * - Scenarios prompts do not collect birth year; users with financial data but missing
 *   birth/retirement ages saw the generic empty state instead of targeted prompts.
 */

export interface ProjectionReadinessInput {
  person1BirthYear: number | null | undefined
  person1RetirementAge: number | null | undefined
  totalIncome: number
  totalAssets: number
}

export type ProjectionMissingField = 'birth_year' | 'retirement_age' | 'income_or_assets'

export interface ProjectionReadinessResult {
  ready: boolean
  missingFields: ProjectionMissingField[]
  /** True when assets/income exist but birth year or retirement age is still missing. */
  canShowPartial: boolean
}

export function checkProjectionReadiness(
  input: ProjectionReadinessInput,
): ProjectionReadinessResult {
  const missing: ProjectionMissingField[] = []

  if (!input.person1BirthYear) {
    missing.push('birth_year')
  }
  if (!input.person1RetirementAge) {
    missing.push('retirement_age')
  }
  const hasFinancialData = input.totalIncome > 0 || input.totalAssets > 0
  if (!hasFinancialData) {
    missing.push('income_or_assets')
  }

  const canShowPartial =
    hasFinancialData && missing.some((f) => f === 'birth_year' || f === 'retirement_age')

  return {
    ready: missing.length === 0,
    missingFields: missing,
    canShowPartial,
  }
}

export const PROJECTION_FIELD_LABELS: Record<ProjectionMissingField, string> = {
  birth_year: 'your birth year',
  retirement_age: 'your target retirement age',
  income_or_assets: 'at least one income source or asset',
}
