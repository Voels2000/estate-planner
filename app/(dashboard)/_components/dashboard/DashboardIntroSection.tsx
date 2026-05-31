import Link from 'next/link'
import type { CompletionScore } from '@/lib/get-completion-score'
import type { EstateHealthScore } from '@/lib/estate-health-score'
import { formatDollars } from '@/lib/utils/formatCurrency'

type DashboardIntroSectionProps = {
  greeting: string
  firstName: string
  completionScore?: CompletionScore | null
  estateHealthScore?: EstateHealthScore | null
  consumerTier?: number
  statePrimary?: string | null
  estateTaxExposure?: {
    estimatedTaxState: number
    estimatedTaxFederal: number
  } | null
  showReadinessPill?: boolean
}

export function DashboardIntroSection(props: DashboardIntroSectionProps) {
  const {
    greeting,
    firstName,
    completionScore,
    estateHealthScore,
    statePrimary,
    estateTaxExposure,
    showReadinessPill = true,
  } = props

  const totalTax =
    (estateTaxExposure?.estimatedTaxState ?? 0) + (estateTaxExposure?.estimatedTaxFederal ?? 0)
  const readinessScore = estateHealthScore?.score ?? null

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]" suppressHydrationWarning>
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-[color:var(--mwm-text-secondary)]">
            Your estate planning dashboard
            {statePrimary ? ` · ${statePrimary} state` : ''}
          </p>
        </div>
      </div>

      {completionScore && !completionScore.unlocked && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">🔓 Unlock Estate Planning</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                {totalTax > 0
                  ? `Your estate has ${formatDollars(totalTax)} in estimated tax exposure. Upgrade to model strategies to reduce it.`
                  : 'Complete your Retirement Planning checklist to unlock Estate Planning'}
              </p>
            </div>
            <Link
              href="/unlock-estate"
              className="shrink-0 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-200 transition"
            >
              View checklist →
            </Link>
          </div>
          <div className="w-full bg-amber-100 rounded-full h-2.5 mb-3">
            <div
              className="bg-amber-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((completionScore.completed / completionScore.total) * 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span>
              {completionScore.completed} of {completionScore.total} steps complete
            </span>
            {completionScore.unlocked && (
              <span>Ready to unlock</span>
            )}
          </div>
        </div>
      )}

      {showReadinessPill && readinessScore != null && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
              readinessScore >= 80
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : readinessScore >= 60
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-800',
            ].join(' ')}
          >
            <i className="ti ti-shield-check" aria-hidden="true" style={{ fontSize: 11 }} />
            Estate readiness {readinessScore}/100
          </span>
        </div>
      )}
    </>
  )
}
