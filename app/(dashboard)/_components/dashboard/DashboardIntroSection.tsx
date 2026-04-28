import Link from 'next/link'
import type { CompletionScore } from '@/lib/get-completion-score'

type SetupStep = {
  key: string
  label: string
  href: string
  done: boolean
}

type DashboardIntroSectionProps = {
  greeting: string
  firstName: string
  allDone: boolean
  progressPct: number
  completedSteps: number
  setupSteps: SetupStep[]
  completionScore?: CompletionScore | null
}

export function DashboardIntroSection(props: DashboardIntroSectionProps) {
  const {
    greeting,
    firstName,
    allDone,
    progressPct,
    completedSteps,
    setupSteps,
    completionScore,
  } = props

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-neutral-900" suppressHydrationWarning>
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {allDone
              ? 'Your Estate Summary'
              : `You're ${progressPct}% set up. Complete the steps below to get the most out of Estate Planner.`}
          </p>
        </div>
      </div>

      {!allDone && (
        <div className="mb-6 bg-white rounded-2xl border border-neutral-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Setup Progress</h2>
            <span className="text-sm font-semibold text-neutral-500">
              {completedSteps} of {setupSteps.length} complete
            </span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-2.5 mb-5">
            <div
              className="bg-neutral-900 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {setupSteps.map((step) => (
              <Link
                key={step.key}
                href={step.href}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition hover:shadow-sm ${
                  step.done
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300'
                }`}
              >
                <span className="text-lg">{step.done ? '✅' : '⭕'}</span>
                <span className={`font-medium ${step.done ? 'line-through opacity-60' : ''}`}>{step.label}</span>
                {!step.done && <span className="ml-auto text-xs text-neutral-400">→</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

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
            <span>{completionScore.completed} of {completionScore.total} complete</span>
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
    </>
  )
}
