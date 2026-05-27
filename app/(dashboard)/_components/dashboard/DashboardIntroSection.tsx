import Link from 'next/link'
import type { CompletionScore } from '@/lib/get-completion-score'

type DashboardIntroSectionProps = {
  greeting: string
  firstName: string
  completionScore?: CompletionScore | null
  conflictReport?: {
    critical: number
    warnings: number
  } | null
}

export function DashboardIntroSection(props: DashboardIntroSectionProps) {
  const { greeting, firstName, completionScore, conflictReport } = props

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[color:var(--mwm-navy)]" suppressHydrationWarning>
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-600">Your estate planning dashboard.</p>
        </div>
      </div>

      {completionScore && !completionScore.unlocked && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-neutral-900">🔓 Unlock Estate Planning</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Complete {completionScore.threshold} of {completionScore.total} Retirement Planning steps
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
              {completionScore.completed} of {completionScore.total} complete
            </span>
            <span>
              {completionScore.threshold - completionScore.completed > 0
                ? `${completionScore.threshold - completionScore.completed} more step${
                    completionScore.threshold - completionScore.completed === 1 ? '' : 's'
                  } to unlock`
                : '🎉 Ready to unlock!'}
            </span>
          </div>
        </div>
      )}

      {conflictReport &&
        (conflictReport.critical > 0 || conflictReport.warnings > 0) && (
          <div className="mb-4 flex items-center gap-2">
            {conflictReport.critical > 0 && (
              <a
                href="#estate-conflicts"
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
              >
                🚨 {conflictReport.critical} critical
              </a>
            )}
            {conflictReport.warnings > 0 && (
              <a
                href="#estate-conflicts"
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition"
              >
                ⚠️ {conflictReport.warnings} warnings
              </a>
            )}
            <a
              href="#estate-conflicts"
              className="text-xs text-neutral-400 hover:text-neutral-600 underline-offset-2 hover:underline transition"
            >
              See issues below
            </a>
          </div>
        )}
    </>
  )
}
